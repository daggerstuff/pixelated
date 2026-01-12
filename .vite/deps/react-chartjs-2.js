import {
  require_jsx_runtime
} from "./chunk-3LTSPBUZ.js";
import {
  require_react
} from "./chunk-VZKCEW2Y.js";
import {
  __toESM
} from "./chunk-PLDDJCW6.js";

// node_modules/.pnpm/react-chartjs-2@5.3.1_chart.js@4.5.1_react@19.2.3/node_modules/react-chartjs-2/dist/index.js
var import_jsx_runtime = __toESM(require_jsx_runtime());
var import_react = __toESM(require_react());
import { Chart as Chart$1, LineController, BarController, RadarController, DoughnutController, PolarAreaController, BubbleController, PieController, ScatterController } from "chart.js";
var defaultDatasetIdKey = "label";
function reforwardRef(ref, value) {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
}
function setOptions(chart, nextOptions) {
  const options = chart.options;
  if (options && nextOptions) {
    Object.assign(options, nextOptions);
  }
}
function setLabels(currentData, nextLabels) {
  currentData.labels = nextLabels;
}
function setDatasets(currentData, nextDatasets, datasetIdKey = defaultDatasetIdKey) {
  const addedDatasets = [];
  currentData.datasets = nextDatasets.map((nextDataset) => {
    const currentDataset = currentData.datasets.find((dataset) => dataset[datasetIdKey] === nextDataset[datasetIdKey]);
    if (!currentDataset || !nextDataset.data || addedDatasets.includes(currentDataset)) {
      return {
        ...nextDataset
      };
    }
    addedDatasets.push(currentDataset);
    Object.assign(currentDataset, nextDataset);
    return currentDataset;
  });
}
function cloneData(data, datasetIdKey = defaultDatasetIdKey) {
  const nextData = {
    labels: [],
    datasets: []
  };
  setLabels(nextData, data.labels);
  setDatasets(nextData, data.datasets, datasetIdKey);
  return nextData;
}
function getDatasetAtEvent(chart, event) {
  return chart.getElementsAtEventForMode(event.nativeEvent, "dataset", {
    intersect: true
  }, false);
}
function getElementAtEvent(chart, event) {
  return chart.getElementsAtEventForMode(event.nativeEvent, "nearest", {
    intersect: true
  }, false);
}
function getElementsAtEvent(chart, event) {
  return chart.getElementsAtEventForMode(event.nativeEvent, "index", {
    intersect: true
  }, false);
}
function ChartComponent(props, ref) {
  const { height = 150, width = 300, redraw = false, datasetIdKey, type, data, options, plugins = [], fallbackContent, updateMode, ...canvasProps } = props;
  const canvasRef = (0, import_react.useRef)(null);
  const chartRef = (0, import_react.useRef)(null);
  const renderChart = () => {
    if (!canvasRef.current) return;
    chartRef.current = new Chart$1(canvasRef.current, {
      type,
      data: cloneData(data, datasetIdKey),
      options: options && {
        ...options
      },
      plugins
    });
    reforwardRef(ref, chartRef.current);
  };
  const destroyChart = () => {
    reforwardRef(ref, null);
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
  };
  (0, import_react.useEffect)(() => {
    if (!redraw && chartRef.current && options) {
      setOptions(chartRef.current, options);
    }
  }, [
    redraw,
    options
  ]);
  (0, import_react.useEffect)(() => {
    if (!redraw && chartRef.current) {
      setLabels(chartRef.current.config.data, data.labels);
    }
  }, [
    redraw,
    data.labels
  ]);
  (0, import_react.useEffect)(() => {
    if (!redraw && chartRef.current && data.datasets) {
      setDatasets(chartRef.current.config.data, data.datasets, datasetIdKey);
    }
  }, [
    redraw,
    data.datasets
  ]);
  (0, import_react.useEffect)(() => {
    if (!chartRef.current) return;
    if (redraw) {
      destroyChart();
      setTimeout(renderChart);
    } else {
      chartRef.current.update(updateMode);
    }
  }, [
    redraw,
    options,
    data.labels,
    data.datasets,
    updateMode
  ]);
  (0, import_react.useEffect)(() => {
    if (!chartRef.current) return;
    destroyChart();
    setTimeout(renderChart);
  }, [
    type
  ]);
  (0, import_react.useEffect)(() => {
    renderChart();
    return () => destroyChart();
  }, []);
  return (0, import_jsx_runtime.jsx)("canvas", {
    ref: canvasRef,
    role: "img",
    height,
    width,
    ...canvasProps,
    children: fallbackContent
  });
}
var Chart = (0, import_react.forwardRef)(ChartComponent);
function createTypedChart(type, registerables) {
  Chart$1.register(registerables);
  return (0, import_react.forwardRef)((props, ref) => (0, import_jsx_runtime.jsx)(Chart, {
    ...props,
    ref,
    type
  }));
}
var Line = createTypedChart("line", LineController);
var Bar = createTypedChart("bar", BarController);
var Radar = createTypedChart("radar", RadarController);
var Doughnut = createTypedChart("doughnut", DoughnutController);
var PolarArea = createTypedChart("polarArea", PolarAreaController);
var Bubble = createTypedChart("bubble", BubbleController);
var Pie = createTypedChart("pie", PieController);
var Scatter = createTypedChart("scatter", ScatterController);
export {
  Bar,
  Bubble,
  Chart,
  Doughnut,
  Line,
  Pie,
  PolarArea,
  Radar,
  Scatter,
  getDatasetAtEvent,
  getElementAtEvent,
  getElementsAtEvent
};
//# sourceMappingURL=react-chartjs-2.js.map
