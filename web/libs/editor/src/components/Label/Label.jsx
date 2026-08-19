import chroma from "chroma-js";
import React, { useMemo } from "react";
import { cn } from "../../utils/bem";
import { asVars } from "../../utils/styles";

import "./Label.scss";

export const Label = React.forwardRef(
  (
    {
      className,
      style,
      color,
      empty = false,
      hidden = false,
      selected = false,
      margins = false,
      rounded = false,
      onClick,
      children,
      hotkey,
      ...rest
    },
    ref,
  ) => {
    const styles = useMemo(() => {
      if (!color) return null;
      const background = chroma(color).alpha(0.15);
      const borderColor = chroma(color).alpha(0.4);

      return {
        ...(style ?? {}),
        ...asVars({
          color,
          background,
          borderColor,
        }),
      };
    }, [color]);

    return (
      <span
        ref={ref}
        className={cn("label")
          .mod({ empty, hidden, selected, clickable: !!onClick, margins, rounded })
          .mix(className)
          .toClassName()}
        style={styles}
        onClick={onClick}
        {...rest}
      >
        <span className={cn("label").elem("text").toClassName()}>{children}</span>
        {hotkey ? <span className={cn("label").elem("hotkey").toClassName()}>{hotkey}</span> : null}
      </span>
    );
  },
);