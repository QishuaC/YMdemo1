const { exec } = require('child_process');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname);

function executeCommand(command, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== ${description} ===`);
    exec(command, { cwd: ROOT_DIR }, (error, stdout, stderr) => {
      if (stdout) console.log(stdout);
      if (stderr && !error) console.log(stderr);
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function autoBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    console.log('🚀 开始自动备份...');
    console.log('时间:', timestamp);

    await executeCommand('git add -A', '添加文件到暂存区');
    
    await executeCommand(`git commit -m "自动备份: ${timestamp}"`, '创建提交');
    
    console.log('\n✅ 本地备份完成！');
    console.log('\n💡 提示：如果想推送到远程仓库，请先配置远程仓库地址：');
    console.log('   git remote add origin <你的远程仓库地址>');
    console.log('   git push -u origin main');
    
  } catch (error) {
    console.error('\n❌ 备份失败:', error.message);
  }
}

autoBackup();
