# Implementation Notes (candidate fills)

- State management choice and why:
  I chose to continue using Zustand because it's simple and lightweight. It's just a small library that gives you a store without all the boilerplate that Redux requires. Also since this is a real-time dashboard that needs to update frequently, Zustand is very good for this because it is fast that wouldn't slow down the UI updates.

- WebSocket batching/back-pressure approach:
  I implemented a simple batching system that groups incoming WebSocket messages together and processes them every 500ms. This prevents the UI from getting overwhelmed when lots of devices send updates at once. The 500ms delay is small enough that users don't notice, but it gives the browser breathing room to handle the updates smoothly.

- Handling duplicates/out-of-order (seq vs ts) approach:
  I use sequence numbers (seq) to handle this problem. Each device update comes with a sequence number, and I only apply updates that have a higher sequence number than what I've already seen. This prevents old or duplicate messages from overwriting newer data. I also went for 'seq' instead of 'ts' because timestamps can be wrong due to network delays or different device clocks, but sequence numbers are like page numbers in a book (1,2,3,4).

- Optimistic action & idempotency:
  When a user clicks reboot, I immediately show "Rebooting..." in the UI and sends a unique idempotency key to the server. This key ensures that even if the user clicks reboot multiple times or if there are network issues, the server only processes the reboot once. If something goes wrong, I rollback the UI to show the previous status.  Another thing i did here was to disable the button if the status is rebooting.

- Trade-offs / what I'd do next with more time:
  The current approach prioritizes simplicity and real-time performance. I sacrificed some complexity for speed or even the use of different libraries, making what was given work. With more time, I'd add proper error boundaries, a retry logic for failed WebSocket connections. I'd also add better loading states. Maybe also use better graphic or library to display the CPU data in the device details page(e.g. D3.js or Chart.js).
