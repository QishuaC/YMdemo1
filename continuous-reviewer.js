const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class ContinuousReviewer {
  constructor() {
    this.reviewInterval = 24 * 60 * 60 * 1000;
    this.isRunning = false;
    this.reviewCount = 0;
  }

  log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
  }

  async runReview() {
    if (this.isRunning) {
      this.log('审查正在进行中，跳过本次执行');
      return;
    }

    this.isRunning = true;
    this.reviewCount++;
    
    this.log(`开始第 ${this.reviewCount} 次代码审查`);
    
    try {
      const reviewerPath = path.join(__dirname, 'code-reviewer.js');
      
      if (fs.existsSync(reviewerPath)) {
        exec(`node ${reviewerPath}`, (error, stdout, stderr) => {
          if (error) {
            this.log(`审查执行失败: ${error.message}`);
            return;
          }
          
          this.log('审查完成');
          console.log(stdout);
          
          if (stderr) {
            this.log(`审查警告: ${stderr}`);
          }
          
          this.saveReviewHistory({
            count: this.reviewCount,
            timestamp: new Date().toISOString(),
            output: stdout
          });
        });
      } else {
        this.log('审查脚本不存在，请先创建 code-reviewer.js');
      }
    } catch (error) {
      this.log(`审查异常: ${error.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  saveReviewHistory(reviewData) {
    const historyPath = path.join(__dirname, 'review-history.json');
    let history = [];
    
    if (fs.existsSync(historyPath)) {
      try {
        history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
      } catch (error) {
        this.log('读取历史记录失败，创建新记录');
      }
    }
    
    history.push(reviewData);
    
    if (history.length > 30) {
      history = history.slice(-30);
    }
    
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
    this.log(`已保存审查历史，共 ${history.length} 条记录`);
  }

  start() {
    this.log('启动持续审查服务');
    this.log(`审查间隔: ${this.reviewInterval / 1000 / 60 / 60} 小时`);
    
    this.runReview();
    
    setInterval(() => {
      this.runReview();
    }, this.reviewInterval);
    
    process.on('SIGINT', () => {
      this.log('收到停止信号，退出审查服务');
      process.exit(0);
    });
  }
}

const reviewer = new ContinuousReviewer();
reviewer.start();
