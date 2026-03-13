# 🔄 自动化代码审查系统

## 概述

本系统提供自动化的代码审查和持续监控功能，帮助团队保持代码质量和系统稳定性。

## 组件

### 1. code-reviewer.js - 代码审查脚本

执行一次性代码审查，检查以下方面：

- **后端代码质量**
  - 日志系统使用
  - 错误处理机制
  - 环境变量配置
  - 数据库缓存

- **前端代码质量**
  - 错误处理完整性
  - 异步操作安全性
  - 内存泄漏风险

- **安全检查**
  - 硬编码密码
  - CORS配置
  - 越权风险

- **性能检查**
  - 请求超时设置
  - 重试机制
  - 缓存策略

### 2. continuous-reviewer.js - 持续审查服务

定期自动执行代码审查：

- **审查频率**: 每24小时
- **历史记录**: 保留最近30次审查
- **自动报告**: 生成JSON格式报告

## 使用方法

### 手动审查

```bash
node code-reviewer.js
```

### 启动持续审查

```bash
node continuous-reviewer.js
```

### 查看审查报告

审查完成后会生成以下文件：

- `review-report.json` - 最新审查报告
- `review-history.json` - 历史审查记录

## 审查报告示例

```json
{
  "timestamp": "2026-03-13T12:00:00.000Z",
  "summary": {
    "filesScanned": 15,
    "issuesFound": 8,
    "criticalIssues": 2,
    "warnings": 6
  },
  "issues": [
    {
      "level": "ERROR",
      "message": "缺少全局错误处理中间件",
      "file": "server.js"
    }
  ],
  "recommendations": [
    "定期检查错误日志",
    "监控API响应时间",
    "定期备份数据库"
  ]
}
```

## 集成到CI/CD

### GitHub Actions

```yaml
name: Code Review
on:
  schedule:
    - cron: '0 0 * * *'
  push:
    branches: [ main ]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Code Review
        run: node code-reviewer.js
      - name: Upload Report
        uses: actions/upload-artifact@v2
        with:
          name: review-report
          path: review-report.json
```

### GitLab CI

```yaml
code_review:
  stage: test
  script:
    - node code-reviewer.js
  artifacts:
    paths:
      - review-report.json
    expire_in: 1 week
  only:
    - schedules
    - main
```

## 自定义审查规则

可以在 `code-reviewer.js` 中添加自定义检查：

```javascript
checkCustomRules() {
  const customPath = path.join(__dirname, 'your-file.js');
  const content = fs.readFileSync(customPath, 'utf-8');
  
  if (content.includes('your-pattern')) {
    this.log('WARN', '发现自定义问题', { file: 'your-file.js' });
  }
}
```

## 监控与告警

### 配置告警阈值

```javascript
const THRESHOLDS = {
  criticalIssues: 0,
  warnings: 5,
  fileSize: 10 * 1024 * 1024
};
```

### 发送通知

可以集成邮件、Slack等通知方式：

```javascript
async sendNotification(report) {
  if (report.summary.criticalIssues > 0) {
    await sendEmail({
      to: 'team@example.com',
      subject: '代码审查发现严重问题',
      body: JSON.stringify(report, null, 2)
    });
  }
}
```

## 最佳实践

1. **定期审查**: 建议每天执行一次
2. **团队协作**: 将报告分享给团队成员
3. **持续改进**: 根据审查结果优化代码
4. **历史对比**: 对比历史数据发现趋势
5. **自动化**: 集成到CI/CD流程

## 扩展功能

### 代码复杂度分析

```javascript
checkComplexity(content) {
  const cyclomaticComplexity = calculateComplexity(content);
  if (cyclomaticComplexity > 10) {
    this.log('WARN', '代码复杂度过高', { complexity: cyclomaticComplexity });
  }
}
```

### 依赖检查

```javascript
checkDependencies() {
  const packageJson = require('./package.json');
  const outdated = checkOutdatedPackages(packageJson);
  if (outdated.length > 0) {
    this.log('WARN', '发现过期依赖', { packages: outdated });
  }
}
```

### 性能基准

```javascript
checkPerformanceBaseline() {
  const metrics = collectMetrics();
  const baseline = loadBaseline();
  
  if (metrics.responseTime > baseline.responseTime * 1.2) {
    this.log('WARN', '性能下降超过20%', { metrics, baseline });
  }
}
```

## 故障排查

### 审查脚本无法运行

```bash
# 检查Node.js版本
node --version

# 检查文件权限
ls -la code-reviewer.js

# 手动执行查看错误
node code-reviewer.js
```

### 报告生成失败

```bash
# 检查磁盘空间
df -h

# 检查文件权限
touch test.json && rm test.json
```

## 相关文档

- [代码审查报告](./CODE_REVIEW_REPORT.md)
- [项目架构文档](./README.md)
- [API文档](./backend/README.md)

---

**维护者**: Backend Architecture Team
**最后更新**: 2026-03-13
