import { useEffect, useRef } from 'react';
import { TransferProgressEvent } from '../types/index.js';

export function useTransferEvents(onEvent: (event: TransferProgressEvent) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    function connect() {
      eventSource = new EventSource('/api/transfers/events');

      eventSource.addEventListener('progress', (e) => {
        try {
          const data: TransferProgressEvent = JSON.parse(e.data);
          onEventRef.current(data);
        } catch {
          // Ignore parse errors
        }
      });

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        // Reconnect after 3s
        reconnectTimeout = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);
}
