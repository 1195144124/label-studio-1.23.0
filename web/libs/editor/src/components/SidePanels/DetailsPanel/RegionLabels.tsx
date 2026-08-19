import { Fragment, type FC } from "react";
import { observer } from "mobx-react";

import { cn } from "../../../utils/bem";

export const RegionLabels: FC<{ region: LSFRegion }> = observer(
  ({ region }) => {
    const labelsInResults = region.labelings.map(
      (result: any) => result.selectedLabels || [],
    );
    const labels: any[] = [].concat(...labelsInResults);

    if (!labels.length)
      return (
        <div className={cn("labels-list").toClassName()}>
          {region.noLabelView || "无标注"}
        </div>
      );

    return (
      <div className={cn("labels-list").toClassName()}>
        {labels.map((label, index) => {
          const color = label.background || "#000000";

          return (
            <Fragment key={label.id}>
              {index ? ", " : null}
              <span style={{ color }}>{label.value}</span>
            </Fragment>
          );
        })}
      </div>
    );
  },
);