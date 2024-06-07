// const pty = require('node-pty');
import * as pty from 'node-pty'
import os from 'os'
const shellpreset = os.platform() === 'win32' ? 'powershell.exe' : 'bash';//
const newspawn = pty.spawn(shellpreset, ["-c", "docker exec -it ubuntu_macvlan /home/nonroot/redir --lport=6097 --cport=22 --caddr=172.35.0.1 ;exit"], {
    name: 'suke_portfowardtest',
    cols: 80,
    rows: 30,
    cwd: process.cwd(),
    env: process.env
});
newspawn.onData((data: string) => {
    console.log(data);
});
setTimeout(() => {
    newspawn.write('\x03');
}, 5000);
newspawn.onExit((data) => {
    console.log(data)
})
// newspawn.close((data: string) => {
//     console.log('like see close', data);
// })