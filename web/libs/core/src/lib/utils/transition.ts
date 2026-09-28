type TransitionOptions = {
  init?: (element: HTMLElement) => void;
  transition: (element: HTMLElement) => void;
  onStart?: (element: HTMLElement) => void;
  beforeTransition?: (element: HTMLElement) => Promise<void> | void;
  afterTransition?: (element: HTMLElement) => Promise<void> | void;
};

/**
 * Performs a transition on an element
 */
export const aroundTransition = (
  element: HTMLElement,
  { init, transition, onStart, beforeTransition, afterTransition }: TransitionOptions,
) => {
  return new Promise<void>(async (resolve) => {
    let resolved = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanUp = () => {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      element.removeEventListener("transitionstart", onTransitionStarted);
      element.removeEventListener("transitionend", onTransitionEnded);
      element.removeEventListener("transitioncancel", onTransitionEnded);
    };

    init?.(element);

    const onTransitionStarted = () => {
      onStart?.(element);
    };

    const onTransitionEnded = async () => {
      if (resolved) return;
      resolved = true;
      cleanUp();
      await afterTransition?.(element);
      resolve();
    };

    if (element) {
      element.addEventListener("transitionstart", onTransitionStarted);
      element.addEventListener("transitionend", onTransitionEnded);
      element.addEventListener("transitioncancel", onTransitionEnded);
    }

    await beforeTransition?.(element);

    setTimeout(() => transition(element), 30);

    // Fallback timeout: if transitionend never fires, resolve after 500ms
    fallbackTimer = setTimeout(() => {
      if (!resolved) {
        onTransitionEnded();
      }
    }, 500);
  });
};