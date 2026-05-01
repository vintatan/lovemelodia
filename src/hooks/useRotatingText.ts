import { useState, useEffect } from "react";

export function useRotatingText(messages: string[], interval = 3500): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const timer = setInterval(() => {
      setIndex(i => (i + 1) % messages.length);
    }, interval);
    return () => clearInterval(timer);
  }, [messages.length, interval]);

  return messages[index] ?? "";
}
