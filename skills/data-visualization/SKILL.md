---
name: data-visualization
description: Build accessible, performant data visualizations with Recharts, Chart.js, and D3.js. Chart selection, responsive design, colorblind-safe palettes.
user-invokable: true
---

# Data Visualization

Build accessible, performant data visualizations using modern libraries. Choose the right chart type, implement responsive layouts, and optimize for large datasets.

## Chart Type Selection

Choose charts based on data relationships, not aesthetics.

**BAD - Wrong chart for the task:**
```tsx
// Pie chart for comparing 12 categories - hard to compare angles
<PieChart width={400} height={400}>
  <Pie data={monthlyData} dataKey="value" nameKey="month" />
</PieChart>

// Line chart for categorical data with no time relationship
<LineChart data={productCategories}>
  <Line dataKey="sales" />
</LineChart>
```

**GOOD - Chart matches data structure:**
```tsx
// Bar chart for category comparison - easy to compare lengths
<BarChart width={600} height={400} data={monthlyData}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="month" />
  <YAxis />
  <Tooltip />
  <Bar dataKey="value" fill="#d4943a" />
</BarChart>

// Scatter plot for correlation analysis
<ScatterChart width={600} height={400}>
  <CartesianGrid />
  <XAxis dataKey="age" name="Age" />
  <YAxis dataKey="salary" name="Salary" />
  <Scatter data={employees} fill="#d4943a" />
</ScatterChart>
```

**Chart selection guide:**
- **Bar/Column:** Compare categories, rankings, discrete values
- **Line:** Time series, trends over continuous periods
- **Scatter:** Correlation between two variables, clustering
- **Heatmap:** Patterns in 2D categorical data (day/hour traffic)
- **Area:** Cumulative values over time, part-to-whole relationships
- **Avoid pie charts:** Use bar charts instead (easier comparison)

## Recharts Implementation

Recharts provides React-native declarative charts with built-in responsiveness.

**BAD - Fixed dimensions, no accessibility:**
```tsx
function SalesChart({ data }) {
  return (
    <LineChart width={800} height={300} data={data}>
      <Line dataKey="sales" stroke="red" />
      <Line dataKey="profit" stroke="green" />
    </LineChart>
  );
}
```

**GOOD - Responsive, accessible, properly labeled:**
```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DataPoint {
  date: string;
  sales: number;
  profit: number;
}

interface SalesChartProps {
  data: DataPoint[];
}

const SalesChart: React.FC<SalesChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        aria-label="Sales and profit trend over time"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis
          dataKey="date"
          stroke="#666"
          tick={{ fill: '#666' }}
        />
        <YAxis
          stroke="#666"
          tick={{ fill: '#666' }}
          label={{ value: 'USD', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
          formatter={(value: number) => `$${value.toLocaleString()}`}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="sales"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ fill: '#3b82f6', r: 4 }}
          activeDot={{ r: 6 }}
          name="Sales"
        />
        <Line
          type="monotone"
          dataKey="profit"
          stroke="#d4943a"
          strokeWidth={2}
          dot={{ fill: '#d4943a', r: 4 }}
          name="Profit"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
```

## Colorblind-Safe Palettes

Rainbow colors fail for 8% of men. Use palettes designed for accessibility.

**BAD - Rainbow spectrum, red/green for critical info:**
```tsx
const COLORS = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'];

// Red/green for positive/negative - invisible to deuteranopes
<Bar dataKey="change" fill={value > 0 ? '#00ff00' : '#ff0000'} />
```

**GOOD - Colorblind-safe palette with patterns:**
```tsx
// Paul Tol's colorblind-safe palette
const COLOR_PALETTE = {
  blue: '#4477AA',
  cyan: '#66CCEE',
  green: '#228833',
  yellow: '#CCBB44',
  red: '#EE6677',
  purple: '#AA3377',
  grey: '#BBBBBB',
};

// Use blue/orange for diverging data (safe for all types of colorblindness)
const getDivergingColor = (value: number): string => {
  return value > 0 ? COLOR_PALETTE.blue : COLOR_PALETTE.red;
};

// Add patterns for critical distinctions
<Bar dataKey="change" fill={getDivergingColor(value)}>
  {value < 0 && <pattern id="stripes" patternUnits="userSpaceOnUse" width="4" height="4">
    <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" stroke="#000" strokeWidth="1" />
  </pattern>}
</Bar>
```

**Recommended palettes:**
- **Categorical (up to 7):** Paul Tol's bright scheme
- **Sequential:** Single hue progression (light blue → dark blue)
- **Diverging:** Blue → white → orange (not red → green)

## Performance with Large Datasets

Canvas outperforms SVG for 1000+ points. Use data windowing and memoization.

**BAD - Re-render entire chart on every update:**
```tsx
function LiveChart() {
  const [data, setData] = useState<DataPoint[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setData(prev => [...prev, fetchNewPoint()]); // Unbounded growth
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return <LineChart data={data}><Line dataKey="value" /></LineChart>;
}
```

**GOOD - Windowed data, memoized component, canvas rendering:**
```tsx
import { useMemo, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement);

interface LiveChartProps {
  maxPoints?: number;
}

const LiveChart: React.FC<LiveChartProps> = ({ maxPoints = 100 }) => {
  const [data, setData] = useState<DataPoint[]>([]);

  // Keep only last N points
  const addDataPoint = useCallback((point: DataPoint) => {
    setData(prev => {
      const updated = [...prev, point];
      return updated.slice(-maxPoints);
    });
  }, [maxPoints]);

  useEffect(() => {
    const interval = setInterval(() => {
      addDataPoint(fetchNewPoint());
    }, 1000);
    return () => clearInterval(interval);
  }, [addDataPoint]);

  // Memoize chart config to prevent re-creation
  const chartData = useMemo(() => ({
    labels: data.map(d => d.timestamp),
    datasets: [{
      label: 'Live Value',
      data: data.map(d => d.value),
      borderColor: '#d4943a',
      borderWidth: 2,
      pointRadius: 0, // No dots for performance
    }],
  }), [data]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false, // Disable animations for real-time
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: { display: false }, // Hide labels for performance
      y: { beginAtZero: true },
    },
  }), []);

  return (
    <div style={{ height: '400px' }}>
      <Line data={chartData} options={options} />
    </div>
  );
};
```

**Performance tips:**
- **Canvas vs SVG:** Use Chart.js (canvas) for 1000+ points, Recharts (SVG) for <1000
- **Data windowing:** Keep only visible data in state
- **Disable animations:** Set `animation: false` for real-time updates
- **Remove point dots:** `pointRadius: 0` saves render time
- **Debounce updates:** Batch rapid updates with `requestAnimationFrame`

## Dashboard Layout Patterns

Grid-based responsive layouts with semantic sizing.

**BAD - Fixed pixel grid, no hierarchy:**
```tsx
<div style={{ display: 'flex' }}>
  <div style={{ width: '400px' }}><Chart1 /></div>
  <div style={{ width: '400px' }}><Chart2 /></div>
  <div style={{ width: '400px' }}><Chart3 /></div>
</div>
```

**GOOD - Responsive grid with visual hierarchy:**
```tsx
import { ResponsiveContainer } from 'recharts';

const Dashboard: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
      {/* Primary metric - full width */}
      <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-gray-900 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Revenue Trend</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={revenueData}>
            {/* ... */}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Secondary metrics - 2 columns on desktop */}
      <div className="col-span-1 md:col-span-1 bg-gray-900 p-6 rounded-lg">
        <h3 className="text-lg font-medium mb-4">User Growth</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={userGrowth}>
            {/* ... */}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="col-span-1 md:col-span-1 bg-gray-900 p-6 rounded-lg">
        <h3 className="text-lg font-medium mb-4">Conversion Rate</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={conversionData}>
            {/* ... */}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tertiary - heatmap spans 2 columns */}
      <div className="col-span-1 md:col-span-2 lg:col-span-2 bg-gray-900 p-6 rounded-lg">
        <h3 className="text-lg font-medium mb-4">Activity Heatmap</h3>
        <ResponsiveContainer width="100%" height={200}>
          <ScatterChart>
            {/* ... */}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
```

## D3.js for Custom Visualizations

Use D3 for specialized charts not available in Recharts/Chart.js.

**BAD - Manipulate DOM directly in React:**
```tsx
function CustomChart() {
  useEffect(() => {
    d3.select('#chart').append('svg'); // React loses control
  }, []);

  return <div id="chart"></div>;
}
```

**GOOD - Use refs, let React manage DOM:**
```tsx
import { useRef, useEffect } from 'react';
import * as d3 from 'd3';

interface Node {
  id: string;
  value: number;
}

interface Link {
  source: string;
  target: string;
}

interface NetworkGraphProps {
  nodes: Node[];
  links: Link[];
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({ nodes, links }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = 600;
    const height = 400;

    // Clear previous render
    svg.selectAll('*').remove();

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2));

    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#999')
      .attr('stroke-width', 2);

    const node = svg.append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', (d) => Math.sqrt(d.value) * 5)
      .attr('fill', '#d4943a')
      .attr('aria-label', (d) => `Node ${d.id}, value ${d.value}`);

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, links]);

  return (
    <svg
      ref={svgRef}
      width={600}
      height={400}
      role="img"
      aria-label="Network graph visualization"
    />
  );
};
```

## Accessibility

Screen readers need context. Provide labels, summaries, and data tables.

**BAD - No semantic info, colors only:**
```tsx
<BarChart data={data}>
  <Bar dataKey="value" fill="green" />
</BarChart>
```

**GOOD - ARIA labels, semantic HTML, text alternatives:**
```tsx
import { BarChart, Bar, XAxis, YAxis } from 'recharts';

const AccessibleChart: React.FC<{ data: DataPoint[] }> = ({ data }) => {
  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));

  return (
    <figure>
      <figcaption className="sr-only">
        Sales by quarter: Q1 ${data[0].value}, Q2 ${data[1].value}, Q3 ${data[2].value}, Q4 ${data[3].value}.
        Highest quarter: {data.find(d => d.value === maxValue)?.quarter}.
      </figcaption>

      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={data}
          role="img"
          aria-label="Quarterly sales bar chart"
        >
          <XAxis
            dataKey="quarter"
            label={{ value: 'Quarter', position: 'insideBottom', offset: -5 }}
          />
          <YAxis
            label={{ value: 'Sales (USD)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Sales']}
          />
          <Bar
            dataKey="value"
            fill="#d4943a"
            aria-label="Sales values"
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Provide data table for screen readers */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-gray-400">View data table</summary>
        <table className="mt-2 text-sm">
          <thead>
            <tr>
              <th className="text-left pr-4">Quarter</th>
              <th className="text-right">Sales</th>
            </tr>
          </thead>
          <tbody>
            {data.map(d => (
              <tr key={d.quarter}>
                <td className="pr-4">{d.quarter}</td>
                <td className="text-right">${d.value.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
};
```

**Accessibility checklist:**
- Add `role="img"` and `aria-label` to charts
- Use `<figure>` and `<figcaption>` for semantic structure
- Provide text summary in `.sr-only` class
- Include data table alternative
- Label axes and provide units
- Use patterns or textures in addition to color
- Ensure 4.5:1 contrast ratio for text on charts
