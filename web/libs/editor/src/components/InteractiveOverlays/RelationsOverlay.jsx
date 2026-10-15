import { observer } from "mobx-react";
import { isAlive } from "mobx-state-tree";
import { createRef, forwardRef, PureComponent, useEffect, useRef } from "react";
import { useState } from "react";
import AutoSizer from "react-virtualized-auto-sizer";

import { FF_DEV_3391, isFF } from "../../utils/feature-flags";
import { isDefined, clamp } from "../../utils/utilities";
import NodesConnector from "./NodesConnector";

import styles from "./RelationsOverlay.module.scss";

const ArrowMarker = ({ id, color }) => {
  return (
    <marker
      id={`arrow-${id}`}
      viewBox="0 0 10 10"
      refX={8}
      refY={5}
      markerWidth={4}
      markerHeight={4}
      orient="auto-start-reverse"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
    </marker>
  );
};

const RelationItemRect = ({ x, y, width, height }) => {
  return <rect x={x} y={y} width={width} height={height} fill="none" />;
};

const RelationConnector = ({ id, command, color, direction, highlight }) => {
  const pathColor = highlight ? "#fa541c" : color;
  const pathSettings = {
    d: command,
    stroke: pathColor,
    fill: "none",
    strokeLinecap: "round",
  };

  const markers = {};

  if (direction === "bi" || direction === "right") {
    markers.markerEnd = `url(#arrow-${id})`;
  }
  if (direction === "bi" || direction === "left") {
    markers.markerStart = `url(#arrow-${id})`;
  }

  return (
    <>
      <defs>
        <ArrowMarker id={id} color={pathColor} />
      </defs>
      {highlight && <path {...pathSettings} stroke={color} opacity={0.1} strokeWidth={6} />}
      <path {...pathSettings} opacity={highlight ? 1 : 0.6} strokeWidth={2} {...markers} />
    </>
  );
};

/**
 * 预设的关系颜色数组（与 NodesConnector.js 保持一致）
 */
const RELATION_COLORS = [
  "#1890ff", // 蓝色
  "#52c41a", // 绿色
  "#faad14", // 黄色
  "#f5222d", // 红色
  "#722ed1", // 紫色
  "#eb2f96", // 粉色
  "#13c2c2", // 青色
  "#fa8c16", // 橙色
  "#eb3349", // 玫红
  "#389e0d", // 深绿
  "#0099ff", // 天蓝
  "#27be68", // 浅绿
  "#ffcc00", // 金黄
  "#ff6666", // 浅红
  "#9966ff", // 浅紫
  "#ff66cc", // 浅粉
  "#0040cc", // 蓝色
  "#ff9933", // 深橙
  "#101399", // 深蓝
  "#53cc33", // 亮绿
];

/**
 * 根据标签值生成颜色
 */
const getColorByLabel = (labels) => {
  if (!labels || labels.length === 0) {
    return "#fa541c";
  }

  const labelStr = Array.isArray(labels) ? labels.join(",") : String(labels);
  let hash = 0;
  for (let i = 0; i < labelStr.length; i++) {
    hash = labelStr.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % RELATION_COLORS.length;
  return RELATION_COLORS[index];
};

/**
 * 估算标签文字的半宽（像素），用于判断两条关系的标签是否会水平/垂直交叠。
 * 中文按约 13px、英文/数字按约 7px 估算，再加两侧内边距。
 */
const estimateLabelHalfWidth = (label = "") => {
  let w = 0;

  for (const ch of String(label)) {
    w += ch.charCodeAt(0) > 255 ? 13 : 7;
  }

  return Math.max(14, (w + 14) / 2);
};

/**
 * 两条关系是否会在同一通道内相互遮挡：
 * - 顶部（top）关系：标签处于同一高度，仅当水平方向（标签 x 区间）交叠且
 *   处于相邻行（baseY 相近）时才冲突；
 * - 侧边（left/right）关系：标签处于同一横向位置，仅当垂直方向（标签 y 区间）
 *   交叠且横向锚点相近时才冲突。
 * 注意：冲突判定始终在同一条通道内（同一 lane）进行，故无需考虑通道高度差。
 */
const LABEL_H = 22;

const labelConflicts = (a, b) => {
  if (a.kind === "top") {
    return a.xMin <= b.xMax && a.xMax >= b.xMin && Math.abs(a.baseY - b.baseY) < LABEL_H;
  }

  return a.yMin <= b.yMax && a.yMax >= b.yMin && Math.abs(a.baseX - b.baseX) < a.halfW + b.halfW;
};

const RelationLabel = ({ label, position, labels, rootRef }) => {
  const [px, py] = position;
  const textRef = useRef();
  const [renderX, setRenderX] = useState(px);
  const [renderY, setRenderY] = useState(py);
  const [background, setBackground] = useState({ width: 0, height: 0, x: 0, y: 0 });

  // 根据标签动态获取颜色
  const bgColor = getColorByLabel(labels);

  const groupAttributes = {
    transform: `translate(${renderX}, ${renderY})`,
    textAnchor: "middle",
    dominantBaseline: "middle",
  };

  const textAttributes = {
    fill: "white",
    style: { fontSize: 12, fontFamily: "arial" },
  };

  useEffect(() => {
    const textElement = textRef.current;

    if (!textElement) return;

    const bbox = textElement.getBBox();
    const bg = {
      x: bbox.x - 5,
      y: bbox.y - 3,
      width: bbox.width + 10,
      height: bbox.height + 6,
    };

    setBackground(bg);

    // 将标签整体限制在 SVG 可视范围内，避免贴边时被边界裁切而无法完整显示
    const rootEl = rootRef?.current;
    const rootW = rootEl?.clientWidth ?? 0;
    const rootH = rootEl?.clientHeight ?? 0;
    const halfW = bg.width / 2;
    const halfH = bg.height / 2;

    let cx = px;
    let cy = py;

    if (rootW) cx = clamp(cx, halfW, Math.max(halfW, rootW - halfW));
    if (rootH) cy = clamp(cy, halfH, Math.max(halfH, rootH - halfH));

    setRenderX(cx);
    setRenderY(cy);
  }, [label, px, py, rootRef]);

  return (
    <g {...groupAttributes}>
      <rect {...background} stroke={bgColor} strokeWidth={2} fill={bgColor} rx="3" />
      <text ref={textRef} {...textAttributes}>
        {label}
      </text>
    </g>
  );
};

const RelationItem = ({ id, startNode, endNode, direction, rootRef, highlight, dimm, labels, visible, offset = 0 }) => {
  const root = rootRef.current;
  const nodesHidden = startNode.hidden === true || endNode.hidden === true;
  const hideConnection = nodesHidden || !visible;
  const [, forceUpdate] = useState();

  const relation = NodesConnector.connect({ id, startNode, endNode, direction, labels }, root);
  const { start, end } = NodesConnector.getNodesBBox({ root, ...relation });

  useEffect(() => {
    relation.onChange(() => forceUpdate({}));
    return () => relation.destroy();
    // 依赖 relation：每次重渲染会创建新的连接，旧的需在此销毁，避免 watcher 泄漏
  }, [relation]);
  if (start.width < 1 || start.height < 1 || end.width < 1 || end.height < 1) return null;

  // 依据当前关系所处的「通道」错开偏移，避免多条关系重叠挤压
  const [path, textPosition] = NodesConnector.calculatePath(start, end, offset);

  const itemStyles = [styles.relationItem];
  if (highlight) {
    itemStyles.push(styles._highlighted);
  }

  return (
    <g id={id} className={itemStyles.join(" ")} visibility={hideConnection ? "hidden" : "visible"}>
      <RelationItemRect {...start} />
      <RelationItemRect {...end} />
      <RelationConnector
        id={relation.id}
        command={path}
        color={relation.color}
        direction={relation.direction}
        highlight={highlight}
      />
      {relation.label && (
        <RelationLabel label={relation.label} position={textPosition} labels={relation.labels} rootRef={rootRef} />
      )}
    </g>
  );
};

/**
 * @param {{
 * item: object,
 * rootRef: React.RefObject<HTMLElement>
 * }}
 */
const RelationItemObserver = observer(({ relation, startNode, endNode, visible, ...rest }) => {
  const nodes = [
    startNode.getRegionElement ? startNode.getRegionElement() : startNode,
    endNode.getRegionElement ? endNode.getRegionElement() : endNode,
  ];

  const [render, setRender] = useState(nodes[0] && nodes[1]);

  useEffect(() => {
    let timer;

    const watchRegionAppear = () => {
      const nodesExist = isDefined(nodes[0]) && isDefined(nodes[1]);

      if (render !== nodesExist) {
        setRender(nodesExist);
      } else if (render === false) {
        timer = setTimeout(watchRegionAppear, 30);
      }
    };

    timer = setTimeout(watchRegionAppear, 30);

    return () => clearTimeout(timer);
  }, [nodes, render]);

  const visibility = visible && relation.visible;

  return render && relation.shouldRender ? (
    <RelationItem
      id={relation.id}
      startNode={startNode}
      endNode={endNode}
      direction={relation.direction}
      visible={visibility}
      labels={relation.selectedValues}
      {...rest}
    />
  ) : null;
});

class RelationsOverlay extends PureComponent {
  /** @type {React.RefObject<HTMLElement>} */
  rootNode = createRef();
  timer = null;
  state = {
    shouldRender: false,
    shouldRenderConnections: Math.random(),
  };

  componentDidUpdate() {
    if (this.rootNode.current && !this.state.shouldRender) {
      this.setState({ shouldRender: true });
    }
  }

  componentDidMount() {
    // 监听任意容器的滚动（捕获阶段可捕获内部可滚动区域的 scroll 事件），
    // 滚动后重新计算关系位置，使其与滚动后的文字保持对齐
    this._onScroll = this._onScroll.bind(this);
    window.addEventListener("scroll", this._onScroll, true);
  }

  componentWillUnmount() {
    window.removeEventListener("scroll", this._onScroll, true);
    if (this._scrollRaf) cancelAnimationFrame(this._scrollRaf);
  }

  _onScroll() {
    if (this._scrollRaf) return;

    this._scrollRaf = requestAnimationFrame(() => {
      this._scrollRaf = null;
      // 触发重渲染以用最新的 getBoundingClientRect 重新计算所有关系坐标
      this.setState((s) => ({ shouldRenderConnections: Math.random() }));
    });
  }

  render() {
    const { relations, visible, highlighted } = this.props;
    const hasHighlight = !!highlighted;

    const style = {
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      position: "absolute",
      pointerEvents: "none",
      zIndex: 100,
      // 允许关系标签/连线在贴近边缘时溢出显示，避免被 SVG 边界裁切
      overflow: "visible",
    };

    const containerStyles = ["relations-overlay", styles.container];
    if (hasHighlight) {
      containerStyles.push(styles._highlighting);
    }

    return (
      <AutoSizer onResize={this.onResize}>
        {() => (
          <svg
            className={containerStyles.join(" ")}
            ref={this.rootNode}
            xmlns="http://www.w3.org/2000/svg"
            style={style}
          >
            <title>{this.state.shouldRender ? "Arrow Marker" : ""}</title>
            {this.state.shouldRender && this.renderRelations(relations, visible, hasHighlight, highlighted)}
            {
              // moving a highlighted relation into the foreground
              highlighted ? <use xlinkHref={`#${highlighted.id}`} /> : null
            }
          </svg>
        )}
      </AutoSizer>
    );
  }

  renderRelations(relations, visible, hasHighlight, highlightedRelation) {
    const root = this.rootNode.current;

    // 为同侧的多条关系分配不同的「通道」偏移，使它们错开显示而不相互重叠挤压。
    // 冲突依据「标签的实际位置」而非整个实体跨度，避免一条跨多实体的关系
    // 错误地占用其它本不相交关系的通道；并按位置排序后贪心分配，使彼此不相交的
    // 关系（如 3-4）能落到最低的可用通道。
    const offsets = {};

    if (root) {
      const labelTextOf = (relation) => (relation.selectedValues ?? []).join(", ");

      // 先按侧别分组，并算出每条关系的标签占位信息
      const groups = {};

      relations.forEach((relation) => {
        const { start, end } = NodesConnector.getNodesBBoxForRelation(
          {
            id: relation.id,
            startNode: relation.node1,
            endNode: relation.node2,
            direction: relation.direction,
            labels: relation.selectedValues,
          },
          root,
        );

        if (start.width < 1 || start.height < 1 || end.width < 1 || end.height < 1) return;

        const sideKey = NodesConnector.getSideKey(start, end);
        const halfW = estimateLabelHalfWidth(labelTextOf(relation));
        const cx = (start.x + start.width / 2 + end.x + end.width / 2) / 2;
        const cy = (start.y + start.height / 2 + end.y + end.height / 2) / 2;

        // 跨度（水平方向 for top，垂直方向 for side）：跨度越大越应排到更外侧（更高）的通道，
        // 这样较窄的关系可嵌套在内侧，形成不交叉的弧线布局。
        const span =
          sideKey === "top"
            ? Math.max(start.x + start.width, end.x + end.width) - Math.min(start.x, end.x)
            : Math.max(start.y + start.height, end.y + end.height) - Math.min(start.y, end.y);

        let fp;

        if (sideKey === "top") {
          fp = {
            kind: "top",
            xMin: cx - halfW,
            xMax: cx + halfW,
            baseY: Math.min(start.y, end.y),
            halfW,
            span,
          };
        } else {
          const baseX = sideKey === "left" ? Math.min(start.x, end.x) : Math.max(start.x + start.width, end.x + end.width);

          fp = {
            kind: sideKey,
            yMin: cy - 11,
            yMax: cy + 11,
            baseX,
            halfW,
            span,
          };
        }

        (groups[sideKey] || (groups[sideKey] = [])).push({ relation, fp });
      });

      // 每个侧别内：先按跨度升序、再按位置升序排序，再贪心着色。
      // 跨度小的先占用低通道，跨度大的落到更外侧的高通道，保证「宽关系在外、窄关系在内」的嵌套效果。
      Object.values(groups).forEach((list) => {
        list.sort((a, b) => {
          if (a.fp.span !== b.fp.span) return a.fp.span - b.fp.span;
          return a.fp.kind === "top" ? a.fp.xMin - b.fp.xMin : a.fp.yMin - b.fp.yMin;
        });

        const lanes = [];

        list.forEach(({ relation, fp }) => {
          let lane = 0;

          while (lane < 100 && lanes[lane] && lanes[lane].some((f) => labelConflicts(f, fp))) {
            lane++;
          }

          if (!lanes[lane]) lanes[lane] = [];
          lanes[lane].push(fp);

          offsets[relation.id] = lane;
        });
      });
    }

    return relations.map((relation) => {
      const highlighted = highlightedRelation === relation;

      return (
        <RelationItemObserver
          key={relation.id}
          relation={relation}
          rootRef={this.rootNode}
          startNode={relation.node1}
          endNode={relation.node2}
          dimm={hasHighlight && !highlighted}
          highlight={highlighted}
          visible={highlighted || visible}
          offset={offsets[relation.id] ?? 0}
          shouldUpdate={this.state.shouldRenderConnections}
        />
      );
    });
  }

  onResize = () => {
    this.setState({ shouldRenderConnections: Math.random() });
  };
}

const RelationObserverView = observer(RelationsOverlay);

const RelationsOverlayObserver = observer(
  forwardRef(({ store, tags }, ref) => {
    const { relations, showConnections, highlighted } = store;

    return (
      <RelationObserverView
        ref={ref}
        relations={Array.from(relations)}
        visible={showConnections}
        highlighted={highlighted}
        tags={Array.from(tags?.values?.() ?? [])}
      />
    );
  }),
);

let readinessTimer = null;

const checkTagsAreReady = (tags, callback) => {
  clearTimeout(readinessTimer);

  if (isFF(FF_DEV_3391)) {
    if (![...tags.values()].every(isAlive)) return false;
  } else {
    if (!isAlive(tags)) return;
  }

  const ready = Array.from(tags.values()).reduce((res, tag) => {
    return res && (tag?.isReady ?? true);
  }, true);

  callback(ready);

  if (!ready) {
    readinessTimer = setTimeout(() => {
      checkTagsAreReady(tags, callback);
    }, 100);
  }
};

/**
 * @todo Why not just to use container that checks if tags are ready
 *  and do not render any children until they are ready?
 * @see {@link CommentsOverlay}
 */
const EnsureTagsReady = observer(
  forwardRef(({ tags, taskData, ...props }, ref) => {
    const [ready, setReady] = useState(false);

    useEffect(() => {
      checkTagsAreReady(tags, (readyState) => {
        setReady(readyState);
      });

      return () => clearTimeout(readinessTimer);
    }, [taskData, tags]);

    return ready && <RelationsOverlayObserver ref={ref} {...props} />;
  }),
);

export { EnsureTagsReady as RelationsOverlay };
