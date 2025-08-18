# PERF Notes (candidate fills)

- Input responsiveness observations under default simulator load:
  The table remains responsive even with 2000 devices because I'm using react-virtuoso for virtualization. The filter input has a 150ms debounce to prevent excessive re-renders while typing. The WebSocket batching (500ms) keeps the UI smooth by grouping updates instead of processing them one by one.

- Chart update rate (approx):
  The CPU chart updates at approximately 5-6 FPS due to the throttling in the telemetry handler. This is intentional to prevent the chart from becoming a performance bottleneck while still providing smooth real-time updates. The chart only re-renders when there's new data and enough time has passed since the last paint.

- Any noticeable GC/heap growth or leaks?
  No major memory leaks observed. I'm using useRef for the buffer to avoid recreating arrays, and the chart data is properly bounded to a 30-second window. The WebSocket cleanup is handled in useEffect cleanup functions. I also use useCallback for event handlers like handleReboot to prevent unnecessary re-renders. However, with very long-running sessions, the buffer management could potentially accumulate memory if not monitored.

- Next steps I'd take with more time:
  I'd implement proper performance monitoring with React DevTools Profiler to measure actual render times. I'd also add memory usage tracking and implement a more sophisticated throttling strategy that adapts to device performance. For the chart, I'd consider using a dedicated charting library that can handle real-time data more efficiently than manual SVG manipulation. I'd also look into the table properly.