import React, { memo, useRef, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import uuid from 'uuid/v4';
import { attempt } from 'lodash-es';
import SeriesContext from '../SeriesContext';
import { getNonEventHandlerProps, getEventsConfig } from '../../utils/events';
import getModifiedProps from '../../utils/getModifiedProps';
import { logSeriesErrorMessage } from '../../utils/warnings';
import usePrevious from '../UsePrevious';
import useHighcharts from '../UseHighcharts';
import useChart from '../UseChart';
import useAxis from '../UseAxis';
import useColorAxis from '../UseColorAxis';
import createProvidedSeries from './createProvidedSeries';

const EMPTY_ARRAY = [];

const Series = memo(
  ({
    id = uuid,
    data = EMPTY_ARRAY,
    isDataEqual = Object.is,
    type = 'line',
    visible = true,
    children = null,
    axisId,
    requiresAxis = true,
    ...restProps
  }) => {
    const seriesProps = { id, data, type, visible, ...restProps };

    /*
      if (defaultTo(restProps.requiresAxis, true)) {
        const axis = getAxis();
        if(!axis) throw new Error(`Series type="${restProps.type}" should be wrapped inside Axis`);
      }
    */
    const Highcharts = useHighcharts();
    const { addSeries, needsRedraw } = useChart();

    if (process.env.NODE_ENV === 'development') {
      const seriesTypes = Object.keys(Highcharts.seriesTypes);
      if (seriesTypes.indexOf(type) === -1) logSeriesErrorMessage(type);
    }

    const seriesRef = useRef(null);
    const [, setHasSeries] = useState(false);
    const providerValueRef = useRef(null);

    const axis = useAxis(axisId);
    const colorAxis = useColorAxis();

    useEffect(() => {
      if (requiresAxis && !axis) return;
      const opts = getSeriesConfig(seriesProps, axis, colorAxis, requiresAxis);

      seriesRef.current = addSeries(opts, false);
      providerValueRef.current = createProvidedSeries(seriesRef.current);

      setHasSeries(true);
      needsRedraw();
      return () => {
        const series = seriesRef.current;
        if (series && series.remove) {
          // Series may have already been removed, i.e. when Axis unmounted
          attempt(series.remove.bind(series), false);
          seriesRef.current = null;
          needsRedraw();
        }
      };
    }, [axis]);

    const prevProps = usePrevious(seriesProps);

    useEffect(() => {
      if (!prevProps || !seriesRef.current) return;
      const series = seriesRef.current;
      const { visible, data, ...rest } = seriesProps;

      let doRedraw = false;
      // Using setData is more performant than update
      if (isDataEqual(data, prevProps.data) === false) {
        series.setData(data, false);
        doRedraw = true;
      }
      if (visible !== prevProps.visible) {
        series.setVisible(visible, false);
        doRedraw = true;
      }

      const modifiedProps = getModifiedProps(prevProps, rest);
      if (modifiedProps !== false) {
        series.update(modifiedProps, false);
        doRedraw = true;
      }
      if (doRedraw) {
        needsRedraw();
      }
    });

    if (!seriesRef.current) return null;

    return (
      <SeriesContext.Provider value={providerValueRef.current}>
        {children}
      </SeriesContext.Provider>
    );
  }
);

Series.displayName = 'Series';

Series.propTypes = {
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  type: PropTypes.string,
  data: PropTypes.any,
  isDataEqual: PropTypes.func,
  visible: PropTypes.bool,
  children: PropTypes.node,
  axisId: PropTypes.string,
  requiresAxis: PropTypes.bool
};

const getSeriesConfig = (props, axis, colorAxis, requiresAxis) => {
  const { id, data, ...rest } = props;

  const seriesId = typeof id === 'function' ? id() : id;
  const nonEventProps = getNonEventHandlerProps(rest);
  const events = getEventsConfig(rest);

  const config = {
    id: seriesId,
    data,
    events,
    ...nonEventProps
  };

  if (colorAxis) {
    config.colorAxis = colorAxis.id;
  }
  if (requiresAxis) {
    config[axis.type] = axis.id;
  }

  return config;
};

export default Series;
