# Git自动备份使用说明

## 项目概述
本项目已配置Git版本控制系统，实现了软件版本的自动备份功能。

## 已完成的配置

### 1. Git仓库初始化
- ✅ 已在项目目录初始化Git仓库
- ✅ 首次提交已完成

### 2. .gitignore配置
已配置忽略以下文件和目录：
- `.runtime-data/` - 运行时数据
- `backend/data/` - 后端数据
- `backend/uploads/` - 上传文件
- `node_modules/` - Node模块
- IDE配置文件（.vscode, .idea）
- 系统文件（.DS_Store, Thumbs.db）
- 备份文件（*.bak, *.tmp）
- 小程序编译输出（miniprogram_npm/）

### 3. 自动备份脚本
- `auto-git-backup.js` - 自动备份脚本
- `package.json` - 包含backup命令

## 使用方法

### 方法一：使用npm命令（推荐）
```bash
npm run backup
```

### 方法二：直接运行脚本
```bash
node auto-git-backup.js
```

## 常用Git命令

### 查看状态
```bash
git status
```

### 查看提交历史
```bash
git log
```

### 查看文件变更
```bash
git diff
```

### 回退到某个版本
```bash
git checkout <提交ID>
```

### 撤销工作区修改
```bash
git checkout -- <文件名>
```

## 配置远程仓库（可选但推荐）

### 步骤1：创建远程仓库
在GitHub、GitLab或Gitee上创建一个新的空仓库。

### 步骤2：关联远程仓库
```bash
git remote add origin <你的远程仓库地址>
```

### 步骤3：推送代码
```bash
git branch -M main
git push -u origin main
```

### 步骤4：后续推送
```bash
git push
```

## 修改自动备份脚本（添加远程推送）

如果需要自动推送到远程仓库，可以修改 `auto-git-backup.js`：

在 `autoBackup()` 函数中，在commit之后添加：
```javascript
await executeCommand('git push', '推送到远程仓库');
```

## 注意事项

1. **首次使用前**：确保已安装Git
2. **备份频率**：建议在重要修改后及时备份
3. **远程仓库**：配置远程仓库后，代码会有双重保障（本地+云端）
4. **.gitignore**：不要将敏感信息（如密码、密钥）提交到Git仓库

## 故障排除

### 问题：git命令不可用
**解决**：下载并安装Git：https://git-scm.com/

### 问题：提示不是git仓库
**解决**：在项目目录运行 `git init`

### 问题：提交失败
**解决**：检查是否有未添加的文件，运行 `git add -A`

---

**项目目录**：`c:\Users\Qishua\Desktop\Demo\Demo2.1`
**创建日期**：2026-03-13
