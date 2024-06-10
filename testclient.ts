import { readFileSync } from "fs";
import net from "net";
import readline from "readline";

interface SocketType {
    datatype: "add" | "rm" | "list";
    name?: string;
    TCP?: boolean;
    ip?: string;
    cport?: number;
    lport?: number;
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// UNIXドメインソケットのコネクションを作成する
const client = net.createConnection('/tmp/portfowardsuke.sock');
client.on('connect', () => {
    // console.log('connected.');
});
client.on('data', (data: any) => {
    //ここからはlist
    try {
        const data2: any[] = JSON.parse(data.toString());
        data2.map((elem) => {
            console.log(JSON.stringify(elem));
        });
    } catch (error) {
        console.log(data.toString());
    }

    client.end(); // 通信終了
    process.exit();
});
client.on('end', () => {
    // console.log('disconnected.');
});
client.on('error', (err: any) => {
    console.error(err.message);
});

// 入力を取得するための関数
function question(query: string): Promise<string> {
    return new Promise((resolve) => rl.question(query, resolve));
}

// IPアドレスのバリデーション
function isValidIPAddress(ip: string): boolean {
    const ipPatternFixed = /^(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])$/;
    return ipPatternFixed.test(ip);
}

async function getIP(): Promise<string> {
    const ip = await question("ミラー先のIPは？");
    if (!isValidIPAddress(ip)) {
        const osok = await question("これIPじゃないけど大丈夫そ?\n名前解決とかできるかわからんよ?(y/n): ");
        if (osok === "y") {
            return ip;
        } else {
            return getIP();
        }
    } else {
        return ip;
    }
}

async function getPort(msg: string): Promise<number> {
    const getit = await question(msg);
    if (getit.length <= 5) {
        const par = Number(getit);
        if (!isNaN(par)) {
            return par;
        } else {
            console.log("なんか文字混ざってない？？");
            return getPort(msg);
        }
    } else {
        console.log("番号多すぎ");
        return getPort(msg);
    }
}

async function entry() {
    if (process.argv[3]) {
        // 引数がある場合
    } else {
        // 引数がない場合
        const useractions = await question("何がしたいん？(add,rm,list): ");
        switch (useractions) {
            case "add":
                const name = await question("追加したいエントリの名前を教えてね！: ");
                const itsresult = await question("TCPかUDPか教えてね！(t / u): ");
                const istcp = itsresult === "t";
                const ip = await getIP();
                const cport = await getPort("転送先のポートは？: ");
                const lport = await getPort("待ち受けるポートは？: ");
                console.log(`\n名前:${name} TCPか？:${istcp}\n転送先ip:${ip} 転送先ポート:${cport} 待受ポート:${lport}`);
                const isok = await question("これでよろしい？(y/n): ");
                if (isok === "y") {
                    client.write(JSON.stringify({
                        datatype: "add",
                        name: name,
                        TCP: istcp,
                        ip: ip,
                        cport: cport,
                        lport: lport
                    }));
                    return true;
                } else {
                    process.exit();
                }
                break;
            case "rm":
                // 削除の処理をここに追加
                break;
            case "list":
                // リストの処理をここに追加
                break;
            default:
                console.log("なにそれ～");
                process.exit();
                break;
        }
    }
}

entry();
