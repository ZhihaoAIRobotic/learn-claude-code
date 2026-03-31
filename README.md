# Claude Code — 源码构建与本地运行指南

> 适用于 macOS / Linux。Windows 请在 WSL2 下操作。

## 前置条件

- macOS 12+ 或 Linux（已在 macOS ARM64 测试通过）
- 终端使用 zsh 或 bash
- 网络能访问 npm registry（`registry.npmjs.org`）
- 有 Anthropic API Key（在 https://console.anthropic.com 获取）

---

## Step 1 — 安装 Bun

**macOS：**

```bash
brew install oven-sh/bun/bun
```

**Ubuntu / Debian Linux：**

```bash
# 安装系统依赖（如果是精简镜像，可能需要）
sudo apt-get update && sudo apt-get install -y curl unzip git

# 安装 Bun
curl -fsSL https://bun.sh/install | bash

# 使 bun 命令立即可用
source ~/.bashrc   # 或 source ~/.zshrc
```

验证：

```bash
bun --version
# 应输出 1.x.x
```

---

## Step 2 — 准备源码目录

将整个 `src/` 目录复制到目标机器，假设放在 `~/learn-claude-code/`：

```bash
# 示例：从 U 盘或网盘复制
git clone https://github.com/ZhihaoAIRobotic/learn-claude-code.git
```

## Step 3 — 安装 npm 依赖

```bash
cd ~/claude-code-src
bun install
```

预期输出：`460+ packages installed`。

如果 `sharp` 安装失败，忽略即可（已标记为 trustedDependencies）。

---

## Step 4 — 生成缺失模块的桩文件

源码中有部分内部模块（Anthropic 内部工具、feature-gated 模块）不在公开源码中。
需要运行一次桩文件生成脚本来补全它们：

```bash
cd ~/learn-claude-code
bun run setup-stubs.ts
```

预期输出：

```
Created XXX TypeScript stub files
Created XXX resource stub files
Created XXX internal package stubs in node_modules
```

> **注意**：每次 `bun install` 后，`node_modules` 中的内部包桩会被清除，
> 需要重新运行 `bun run setup-stubs.ts`。

---

## Step 5 — 验证运行

```bash
bun --preload ./preload.ts entrypoints/cli.tsx --version
# 应输出: 0.0.1-dev (Claude Code)

bun --preload ./preload.ts entrypoints/cli.tsx --help
# 应输出完整的帮助信息
```

---

## Step 6 — 注册为全局命令（可选）

```bash
# 确保启动脚本有执行权限
chmod +x ~/claude-code-src/claude-dev

# 创建符号链接
mkdir -p ~/.local/bin
ln -sf PATH/learn-claude-code/claude-dev ~/.local/bin/claude-dev

# 将 ~/.local/bin 加入 PATH（如果还没有的话）
# macOS (zsh)
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc

# Ubuntu (bash)
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
```

之后在任意目录使用：

```bash
claude-dev --version
claude-dev --help
claude-dev            # 启动交互式会话
```

---

## Step 7 — 配置 API Key

Claude Code 是本地客户端框架，AI 模型运行在 Anthropic 服务器。必须配置 API Key。

```bash
# 临时使用
export ANTHROPIC_API_KEY="sk-ant-xxxxxxxxxx"
claude-dev

# 持久化（推荐）
echo 'export ANTHROPIC_API_KEY="sk-ant-xxxxxxxxxx"' >> ~/.zshrc
source ~/.zshrc
```

### 网络代理（如果需要）

```bash
export HTTPS_PROXY="http://127.0.0.1:7890"
```

### 使用第三方兼容 API

```bash
export ANTHROPIC_BASE_URL="https://your-proxy-endpoint.com"
export ANTHROPIC_API_KEY="your-key"
```

---

## 故障排除

### `Cannot find module 'xxx'`

运行 `bun run setup-stubs.ts` 重新生成桩文件。如果是新的缺失模块，
在 `setup-stubs.ts` 中的 `missingModules` 数组里添加即可。

### `Cannot find package 'xxx'`

```bash
bun add xxx
```

如果是内部包（`@ant/*` 或 `*-napi`），在 `setup-stubs.ts` 的
`internalPackages` 中添加即可。

### `ERR_BAD_REQUEST` / 无法连接 Anthropic

- 检查 `ANTHROPIC_API_KEY` 是否设置正确
- 检查网络连通性：`curl -I https://api.anthropic.com`
- 如需代理，设置 `HTTPS_PROXY`

### `bun install` 后桩文件丢失

`node_modules` 中的内部包桩会被包管理器覆盖，重新运行：

```bash
bun run setup-stubs.ts
```

---

## 文件说明

| 文件 | 作用 |
|------|------|
| `preload.ts` | Bun 预加载脚本：定义 MACRO 全局变量、shim `bun:bundle` 的 `feature()` 宏（全部返回 false）、注册 .md/.txt 文本加载器 |
| `bunfig.toml` | Bun 配置，指定自动加载 preload.ts |
| `package.json` | npm 依赖声明 |
| `tsconfig.json` | TypeScript 配置，含 `src/` 路径别名 |
| `claude-dev` | Bash 启动脚本，支持符号链接 |
| `setup-stubs.ts` | 一键生成所有缺失模块的桩文件 |
| `shims/bun-bundle.d.ts` | `bun:bundle` 模块的 TypeScript 类型声明 |
| `global.d.ts` | MACRO 全局变量的类型声明 |

---

## Ubuntu 服务器补充说明

- **无 GUI 环境完全正常**：Claude Code 是纯终端应用，不需要桌面环境
- **macOS 专属功能自动降级**：Keychain（密钥链）、plist、MDM 等 macOS 特有模块在 Linux 上会走降级路径，不影响核心功能
- **API Key 认证方式**：在 Linux 服务器上建议直接用环境变量 `ANTHROPIC_API_KEY`（OAuth 登录需要浏览器，服务器上不方便）
- **headless / 非交互模式**：服务器上常用 `-p` 模式（print & exit），适合脚本和管道：
  ```bash
  claude-dev -p "explain this code" < myfile.py
  echo "refactor this function" | claude-dev -p
  ```
- **`sharp` 模块**：在 Ubuntu 上可能需要额外系统库。如安装失败可忽略（图片处理功能降级）：
  ```bash
  sudo apt-get install -y libvips-dev   # 可选，给 sharp 用
  ```

---

## 已知限制

- Feature-gated 的高级功能（voice、bridge、daemon、coordinator、REPL 等）在 dev 构建中禁用
- 内部工具（TungstenTool 等）为空桩，不可用
- 自动更新功能不可用（version 始终为 0.0.1-dev）
- 部分原生模块（color-diff-napi 等）为空桩，语法高亮差异渲染可能降级
