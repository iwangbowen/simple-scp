# 打包和发布指南

## 前置要求

安装 vsce（VS Code Extension CLI）：
```bash
npm install -g @vscode/vsce
```

## 打包插件

生成 `.vsix` 文件（可本地安装或分发）：
```bash
npm run package
```

这将生成类似 `simple-scp-0.0.1.vsix` 的文件。

## 本地安装测试

安装打包好的 vsix 文件：
```bash
code --install-extension simple-scp-0.0.1.vsix
```

或在 VS Code 中：
1. 打开扩展面板 (Ctrl+Shift+X)
2. 点击 "..." 菜单
3. 选择 "Install from VSIX..."
4. 选择生成的 .vsix 文件

## 发布到 Marketplace

### 1. 获取 Personal Access Token (PAT)

1. 访问 https://dev.azure.com/
2. 创建组织（如果没有）
3. 用户设置 → Personal Access Tokens
4. 创建新 Token：
   - Organization: All accessible organizations
   - Scopes: Marketplace → **Manage**
   - 复制生成的 Token

### 2. 创建 Publisher

首次发布需要创建 publisher：
```bash
vsce create-publisher <publisher-name>
```

或访问 https://marketplace.visualstudio.com/manage 创建。

### 3. 登录

```bash
vsce login <publisher-name>
```

输入上面获取的 PAT。

### 4. 发布

```bash
npm run publish
```

或指定版本号：
```bash
vsce publish minor  # 0.0.1 → 0.1.0
vsce publish patch  # 0.0.1 → 0.0.2
vsce publish major  # 0.0.1 → 1.0.0
```

## 更新版本

手动更新 package.json 中的 version 字段，或使用：
```bash
npm version patch  # 0.0.1 → 0.0.2
npm version minor  # 0.0.1 → 0.1.0
npm version major  # 0.0.1 → 1.0.0
```

## 常用命令总结

```bash
# 开发编译
npm run compile

# 监听模式（自动编译）
npm run watch

# 生产构建
npm run build

# 打包插件
npm run package

# 发布到 Marketplace
npm run publish
```

## 注意事项

1. 确保 `package.json` 中的 `publisher` 字段与你创建的 publisher 名称一致
2. 发布前运行 `npm run build` 确保是生产版本
3. 首次发布建议先用 `vsce package` 打包测试
4. `.vscodeignore` 文件控制哪些文件会被包含在 vsix 中
5. 图标文件 `resources/icon.png` 必须存在且为 PNG 格式

## 文件清单检查

打包前确认这些文件存在：
- ✅ `resources/icon.png` - 插件图标（128x128 PNG）
- ✅ `resources/icon.svg` - Activity Bar 图标
- ✅ `README.md` - 插件说明文档
- ✅ `CHANGELOG.md` - 更新日志
- ✅ `LICENSE` - 许可证文件

## Marketplace 信息

发布后插件会在 15 分钟内出现在：
- https://marketplace.visualstudio.com/items?itemName=WangBowen.simple-scp
- VS Code 扩展搜索中
