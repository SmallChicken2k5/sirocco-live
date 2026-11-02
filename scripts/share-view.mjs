import {createViewGateway} from '../lib/view-gateway.mjs';

const args = process.argv.slice(2), values = {};
if (args[0] && !args[0].startsWith('--')) values.group = args.shift();
for (let i=0;i<args.length;i+=2) {
  if (!['--group','--port','--upstream','--host'].includes(args[i]) || !args[i+1] || args[i+1].startsWith('--')) throw new Error('Dùng: npm run share:view -- icpc; hoặc node scripts/share-view.mjs --group icpc --port 8766');
  values[args[i].slice(2)] = args[i+1];
}
if (values.port && (!/^\d+$/.test(values.port) || +values.port < 1 || +values.port > 65535)) throw new Error('Cổng phải nằm trong khoảng 1–65535.');
createViewGateway({...values, port:values.port ? Number(values.port) : 8766}).then(gateway => {
  console.log(`View chỉ đọc: http://127.0.0.1:${gateway.port}/view/${gateway.group}`);
  console.log(`Trỏ tunnel vào http://127.0.0.1:${gateway.port}. Cổng này không có trang hoặc API quản trị.`);
  console.log('Giữ Sirocco Live và tiến trình này chạy. Dừng bằng Ctrl+C để ngừng chia sẻ.');
  const stop = async () => { await gateway.close(); process.exit(0); };
  process.on('SIGINT',stop); process.on('SIGTERM',stop);
}).catch(error => { console.error(`Không mở được cổng View: ${error.message}`); process.exitCode=1; });
