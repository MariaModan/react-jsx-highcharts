import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import uuid from 'uuid/v4';
import { attempt } from 'lodash-es';
import AxisContext from '../AxisContext';
import { getNonEventHandlerProps, getEventsConfig } from '../../utils/events';
import { validAxisTypes } from '../../utils/propTypeValidators';
import useModifiedProps from '../UseModifiedProps';
import useChart from '../UseChart';
import createProvidedAxis from './createProvidedAxis';

const Axis = ({ children = null, dynamicAxis = true, ...restProps }) => {
  const chart = useChart();
  const axisRef = useRef(null);
  const providedAxisRef = useRef(null);

  const modifiedProps = useModifiedProps(restProps);

  if (!axisRef.current) {
    // create axis
    axisRef.current = createAxis(chart, restProps, dynamicAxis);
    providedAxisRef.current = createProvidedAxis(axisRef.current);
    chart.needsRedraw();
  } else {
    // update axis
    if (modifiedProps !== false) {
      const axis = axisRef.current;
      axis.update(modifiedProps, false);
      chart.needsRedraw();
    }
  }

  useEffect(() => {
    // cleanup on unmount
    return () => {
      const axis = axisRef.current;
      if (axis.remove && dynamicAxis) {
        // Axis may have already been removed, i.e. when Chart unmounted
        attempt(axis.remove.bind(axis), false);
        chart.needsRedraw();
      }
    };
  }, []);

  return (
    <AxisContext.Provider value={providedAxisRef.current}>
      {children}
    </AxisContext.Provider>
  );
};

const getAxisConfig = props => {
  const { id = uuid, ...rest } = props;

  const axisId = typeof id === 'function' ? id() : id;
  const nonEventProps = getNonEventHandlerProps(rest);
  const events = getEventsConfig(rest);

  return {
    id: axisId,
    title: { text: null },
    events,
    ...nonEventProps
  };
};

const createAxis = (chart, props, dynamicAxis) => {
  const { id = uuid, isX } = props;

  // Create Highcharts Axis
  const opts = getAxisConfig(props);
  let axis;
  if (dynamicAxis) {
    axis = chart.addAxis(opts, isX, false);
  } else {
    // ZAxis cannot be added dynamically, Maps only have a single axes - update instead
    const axisId = typeof id === 'function' ? id() : id;
    axis = chart.get(axisId);
    axis.update.call(axis, opts, false);
  }
  return axis;
};

Axis.propTypes = {
  type: validAxisTypes,
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  children: PropTypes.node,
  dynamicAxis: PropTypes.bool
};

export default Axis;
