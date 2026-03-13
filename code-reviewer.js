const fs = require('fs');
const path = require('path');

class CodeReviewer {
  constructor() {
    this.issues = [];
    this.stats = {
      filesScanned: 0,
      issuesFound: 0,
      criticalIssues: 0,
      warnings: 0,
      infoCount: 0,
      checkPassed: 0
    };
    this.improvements = [];
  }

  log(level, message, details = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, ...details };
    
    if (level === 'ERROR') {
      this.stats.criticalIssues++;
      this.issues.push(logEntry);
    } else if (level === 'WARN') {
      this.stats.warnings++;
      this.issues.push(logEntry);
    } else if (level === 'INFO') {
      this.stats.infoCount++;
    } else if (level === 'PASS') {
      this.stats.checkPassed++;
    }
    
    this.stats.issuesFound = this.stats.criticalIssues + this.stats.warnings;
    console.log(JSON.stringify(logEntry));
  }

  checkFileExists(filePath) {
    if (!fs.existsSync(filePath)) {
      this.log('ERROR', `文件不存在: ${filePath}`);
      return false;
    }
    return true;
  }

  addImprovement(title, description, priority = 'medium') {
    this.improvements.push({ title, description, priority, timestamp: new Date().toISOString() });
  }

  checkBackendCode() {
    const serverPath = path.join(__dirname, 'backend', 'server.js');
    
    if (!this.checkFileExists(serverPath)) return;
    
    const content = fs.readFileSync(serverPath, 'utf-8');
    this.stats.filesScanned++;
    
    if (content.includes('console.log(') && !content.includes('logger.info(')) {
      this.log('WARN', '建议使用logger替代console.log', { file: 'server.js' });
    } else {
      this.log('PASS', '已使用logger系统', { file: 'server.js' });
    }
    
    if (!content.includes('app.use((err, req, res, next)')) {
      this.log('ERROR', '缺少全局错误处理中间件', { file: 'server.js' });
    } else {
      this.log('PASS', '已配置全局错误处理', { file: 'server.js' });
    }
    
    if (!content.includes('process.env.PORT')) {
      this.log('WARN', '端口配置未使用环境变量', { file: 'server.js' });
    } else {
      this.log('PASS', '已使用环境变量配置端口', { file: 'server.js' });
    }
    
    if (content.includes('readDb()') && !content.includes('readDbWithCache()')) {
      this.log('WARN', '数据库读取未使用缓存机制', { file: 'server.js' });
    } else {
      this.log('PASS', '已使用数据库缓存', { file: 'server.js' });
    }
    
    if (!content.includes('rateLimitMiddleware')) {
      this.log('WARN', '未配置API限流', { file: 'server.js' });
    } else {
      this.log('PASS', '已配置API限流', { file: 'server.js' });
    }
    
    if (!content.includes('validateRequiredFields')) {
      this.log('WARN', '未配置输入验证', { file: 'server.js' });
    } else {
      this.log('PASS', '已配置输入验证', { file: 'server.js' });
    }
    
    if (!content.includes('createBackup')) {
      this.log('WARN', '未配置数据备份', { file: 'server.js' });
    } else {
      this.log('PASS', '已配置数据备份', { file: 'server.js' });
    }
    
    const apiEndpoints = (content.match(/app\.(get|post|put|delete|patch)/g) || []).length;
    this.log('INFO', `发现${apiEndpoints}个API端点`, { file: 'server.js' });
    
    this.addImprovement('添加单元测试', '为关键API添加单元测试覆盖', 'high');
  }

  checkFrontendCode() {
    const pagesDir = path.join(__dirname, 'pages');
    
    if (!fs.existsSync(pagesDir)) {
      this.log('ERROR', 'pages目录不存在');
      return;
    }
    
    const pages = fs.readdirSync(pagesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    pages.forEach(pageName => {
      const jsFile = path.join(pagesDir, pageName, `${pageName}.js`);
      
      if (!fs.existsSync(jsFile)) {
        this.log('WARN', `页面缺少JS文件: ${pageName}`);
        return;
      }
      
      const content = fs.readFileSync(jsFile, 'utf-8');
      this.stats.filesScanned++;
      
      if (content.includes('.catch(() => {})')) {
        this.log('WARN', '空的catch块，错误被吞没', { file: `${pageName}.js` });
      }
      
      if (content.includes('.catch(err => {}') || content.includes('.catch(error => {}')) {
        this.log('WARN', '空的catch块，错误被吞没', { file: `${pageName}.js` });
      }
      
      if (!content.includes('try') && content.includes('app.request')) {
        this.log('WARN', '请求未使用try-catch包裹', { file: `${pageName}.js` });
      }
    });
  }

  checkAuthModule() {
    const authPath = path.join(__dirname, 'utils', 'auth.js');
    
    if (!this.checkFileExists(authPath)) return;
    
    const content = fs.readFileSync(authPath, 'utf-8');
    this.stats.filesScanned++;
    
    if (!content.includes('TOKEN_EXPIRY')) {
      this.log('WARN', 'Token未设置过期机制', { file: 'auth.js' });
    }
    
    if (!content.includes('wx.removeStorageSync(TOKEN_KEY)')) {
      this.log('ERROR', '缺少Token清理逻辑', { file: 'auth.js' });
    }
  }

  checkDatabase() {
    const dbPath = path.join(__dirname, 'backend', 'data', 'db.json');
    
    if (!this.checkFileExists(dbPath)) return;
    
    try {
      const content = fs.readFileSync(dbPath, 'utf-8');
      const db = JSON.parse(content);
      
      this.log('INFO', '数据库统计', {
        users: db.users?.length || 0,
        products: db.products?.length || 0,
        orders: db.orders?.length || 0,
        articles: db.articles?.length || 0,
        videos: db.videos?.length || 0
      });
      
      const fileSize = fs.statSync(dbPath).size;
      if (fileSize > 10 * 1024 * 1024) {
        this.log('WARN', '数据库文件过大，建议迁移到专业数据库', { 
          size: `${(fileSize / 1024 / 1024).toFixed(2)}MB` 
        });
      }
    } catch (error) {
      this.log('ERROR', '数据库文件解析失败', { error: error.message });
    }
  }

  checkSecurity() {
    const serverPath = path.join(__dirname, 'backend', 'server.js');
    
    if (!fs.existsSync(serverPath)) return;
    
    const content = fs.readFileSync(serverPath, 'utf-8');
    
    if (content.includes('password: \'admin123\'') || content.includes('password: "admin123"')) {
      this.log('WARN', '发现硬编码密码，建议使用环境变量', { file: 'server.js' });
    }
    
    if (!content.includes('cors()')) {
      this.log('WARN', '未配置CORS，可能存在跨域问题', { file: 'server.js' });
    }
    
    if (content.includes('x-user-id') && !content.includes('validate')) {
      this.log('WARN', '用户ID未做验证，可能存在越权风险', { file: 'server.js' });
    }
  }

  checkPerformance() {
    const appPath = path.join(__dirname, 'app.js');
    
    if (!fs.existsSync(appPath)) return;
    
    const content = fs.readFileSync(appPath, 'utf-8');
    this.stats.filesScanned++;
    
    if (!content.includes('timeout:')) {
      this.log('WARN', '请求未设置超时时间', { file: 'app.js' });
    }
    
    if (!content.includes('retry:')) {
      this.log('INFO', '建议添加请求重试机制', { file: 'app.js' });
    }
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.stats,
      issues: this.issues,
      improvements: this.improvements,
      recommendations: [
        '定期检查错误日志',
        '监控API响应时间',
        '定期备份数据库',
        '更新依赖包版本',
        '执行安全审计'
      ],
      score: this.calculateScore()
    };
    
    const reportPath = path.join(__dirname, 'review-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n========================================');
    console.log('代码审查报告');
    console.log('========================================');
    console.log(`扫描文件数: ${this.stats.filesScanned}`);
    console.log(`通过检查: ${this.stats.checkPassed}`);
    console.log(`发现问题数: ${this.stats.issuesFound}`);
    console.log(`严重问题: ${this.stats.criticalIssues}`);
    console.log(`警告: ${this.stats.warnings}`);
    console.log(`评分: ${report.score}/100`);
    console.log('========================================\n');
    
    return report;
  }

  calculateScore() {
    const totalChecks = this.stats.checkPassed + this.stats.criticalIssues + this.stats.warnings;
    if (totalChecks === 0) return 100;
    
    const penalty = (this.stats.criticalIssues * 10) + (this.stats.warnings * 3);
    const baseScore = Math.max(0, 100 - penalty);
    
    return Math.min(100, Math.floor(baseScore));
  }

  async run() {
    console.log('开始代码审查...\n');
    
    this.checkBackendCode();
    this.checkFrontendCode();
    this.checkAuthModule();
    this.checkDatabase();
    this.checkSecurity();
    this.checkPerformance();
    
    return this.generateReport();
  }
}

const reviewer = new CodeReviewer();
reviewer.run().catch(console.error);
