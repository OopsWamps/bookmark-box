# 书签收纳盒 · 项目工作规则

交互式三维机构设计项目（书签收纳盒凸轮倾斜高级版）。改设计的对象是源文件，不是 785KB 的交付 HTML。

- 权威源文件：`advanced-kinematics.js`、`advanced-renderer.js`、`advanced-annotations.js`、`advanced-engineering-details.html`、`lowbox-renderer.js`、`scene.js`、`kinematics.js`、`annotations.js`、`ui-template.html`、`build.cjs`、`build-advanced.cjs`
- 改源文件后重建：`node build-advanced.cjs`（高级版）、`node build.cjs`（基础版）；禁止手改交付 HTML
- 高级版页面共享 `scene.js` 的闭包作用域：跨模块的演示状态（powerLost、serviceOpen 等）经 `build-advanced.cjs` 的 replace 注入，基础版不受影响

## 总指令

本项目的机械设计协作流程以 `MECHANICAL_DESIGN_PROMPT.md` 为总指令——每次会话开始、任何设计工作之前先读它。要点：区分事实/估算/假设；未运行的检查不得声称完成；用决策卡沟通取舍；校核状态只用 PASS / FAIL / UNVERIFIED / STALE / N/A；变更后做影响分析。

项目记忆在 `design/` 下，每轮实质变更后更新：`PROJECT_STATE.md`（基线与风险）、`DESIGN_TREE.md`（方案树）、`DECISIONS.md`（决策记录）、`VERIFICATION.md`（校核矩阵）、`G3_READINESS.md`（制造缺口与试验计划）。换会话先读这些记录，不要重新发明已批准方案。

## 强制校核门禁

**任何设计源文件修改之后、git 提交之前，以下脚本必须全部运行且全部通过：**

```sh
node verify-kinematics.cjs             # 基础运动/膜卷几何
node verify-advanced-kinematics.cjs    # 高级槽曲线、压力角、间隙、膜长守恒
node verify-advanced-assembly.cjs      # 装配包络与连接件搭接
node verify-rear-bellows.cjs           # 后柔性罩干涉回归
node verify-safety-devices.cjs         # D5-2 安全构件包络/啮合/存在性
node verify-global-clearance.cjs       # 全零件跨组碰撞扫掠（白名单门禁）
```

任何一个脚本失败或新增未知接触，都不得提交、不得声称设计"已验证"；修复后重跑。只改注释、文档、`design/` 记录可豁免，但要在汇报里说明豁免理由。

## 碰撞与包络检查原则

1. **全姿态扫掠**：跨组（固定/车架/倾斜）接触检查必须覆盖升程全程离散采样、开盖中间态、以及安全件的全部状态（爪落下/抬起、挡块翻出）。当前步长：26 个进程采样（升程 0…60）+ 开盖两态 + 爪落下 3 态。
2. **非凸几何不许只用包围盒**：薄壳类件的满尺寸 bbox 会产生大量假阳性；以双向顶点云最近距离（当前 ε=2 mm）为接触判据，bbox 只作预筛。
3. **设计接触白名单**：配合（耳轴-叉轴）、啮合（棘爪-齿）、承托面（托盘筋-车架臂）、软罩夹持（风琴-法兰）是设计意图的接触，登记在 `verify-global-clearance.cjs` 的 WHITELIST 内。**新的未知接触必须人工定性**——确认是设计意图才可入白名单并注明理由；真干涉必须改设计，不许靠放宽白名单消除失败。
4. **离散采样不是连续证明**：报告必须带采样步数与覆盖范围声明，结论措辞用"采样范围内未发现"，不写"全行程绝无干涉"。
5. **量级核对**：数值校核的输出先做手工量级检查再用（本仓库曾三次靠量级异常抓出单位错误）；每个 calc/ 脚本的关键常数注明来源与单位。

## 其他

- 校核脚本用仓库内 `assets/three.min.js`，零 npm 依赖；vm 复用真实渲染器构建零件，不用复刻几何
- 浏览器 QA（`tests/browser/`）需要 Playwright 环境；改动影响部件数量、状态文案、标注计数时同步更新断言
- 交付 HTML 是构建产物，评审沟通以源文件与 `design/` 记录为准
