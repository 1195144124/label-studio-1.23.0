import { Fragment } from "react";
import { observer } from "mobx-react";
import { cn } from "../../../utils/bem";
import { RegionLabelData } from "./zhLable";
export type RegionLabelProps = {
  item: any;
};
export const RegionLabel = observer(({ item }: RegionLabelProps) => {
  const { type } = item ?? {};
  if (!type) {
    return "无标注";
  }
  if (type.includes("label")) {
    return item.value;
  }
  if (type === "reactcode") {
    if (item.values?.length) {
      return (
        <div className={cn("labels-list").toClassName()}>
          {item.values.map((value: string, index: number) => (
            <Fragment key={value}>
              {index ? ", " : null}
              <div className={cn("labels-list").toClassName()}>
                {value.length > 50 ? `${value.slice(0, 50)}...` : value}
              </div>
            </Fragment>
          ))}
        </div>
      );
    }
  }
  if (type.includes("region") || type.includes("range")) {
    const labelsInResults = item.labelings.map(
      (result: any) => result.selectedLabels || [],
    );

    const labels: any[] = [].concat(...labelsInResults);

    return (
      <div className={cn("labels-list").toClassName()}>
        {labels.map((label, index) => {
          const color = label.background || "#000000";

          return (
            <Fragment key={label.id}>
              {index ? ", " : null}
              <div
                className={cn("labels-list").toClassName()}
                style={{ color }}
              >
                {label.value || "无标注"}
              </div>
            </Fragment>
          );
        })}
      </div>
    );
  }
  if (type.includes("tool")) {
    return RegionLabelData[item.value] || item.value;
  }
});