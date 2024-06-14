import { readFileSync } from "fs";
import { parseCommandLine } from "typescript";
import net from "net";
import readline from "readline";
import commandLineArgs from 'command-line-args';
import { error } from "console";
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
    if (!isValidIPAddress(ip) && ip != "host") {
        const osok = await question("これIPじゃないけど大丈夫そ?\n名前解決とかできるかわからんよ?(y/n): ");
        if (osok === "y") {
            return ip;
        } else {
            return getIP();
        }
    } else {
        if (ip === "host") {
            return "172.35.0.1"
        } else {
            return ip;
        }
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
    if (process.argv[2]) {
        // 引数がある場合
        switch (process.argv[2]) {
            case "add":
                function testhost(ip: string) {
                    if (ip === "host") {
                        return "172.35.0.1"
                    } else {
                        return ip;
                    }
                }
                const args = {
                    name: process.argv[3],
                    cport: process.argv[4],
                    lport: process.argv[5],
                    addr: process.argv[6],
                    proto: process.argv[7]
                }

                try {

                    if (Number(args.cport) > 25565 || Number(args.lport) > 25565) {
                        throw error("IPがおかしいよ");
                    }
                    let istcp = false;
                    if (args.proto === "t") { istcp = true } else {
                        if (args.proto !== "u") {
                            console.log(args.proto);
                            throw error("Protocolがおかしいよ");
                        }
                    }

                    client.write(JSON.stringify({
                        datatype: "add",
                        name: args.name,
                        TCP: istcp,
                        ip: testhost(args.addr),
                        cport: args.cport,
                        lport: args.lport
                    }));
                } catch (error) {
                    console.log("なんか引数おかしくない？");
                    process.exit();
                }


                break;
            case "rm":
                if (process.argv[3]) {
                    client.write(JSON.stringify({
                        datatype: "rm",
                        name: process.argv[3]
                    }));
                } else {
                    console.log("引数なんかおかしくない？");
                    process.exit();
                }
                break;
            case "list":
                client.write(JSON.stringify({
                    datatype: "list",
                }));
                break;
            case "help":
                console.log(`ワンライナー書式\n
                    list そのまま利用可能
                    rm [削除したいエントリ名]
                    add name cport lport addr proto(t[cp] or u[dp])
                    `);
                process.exit();
                // name: process.argv[3],
                // cport: process.argv[4],
                // lport: process.argv[5],
                // addr: process.argv[6],
                // proto: process.argv[7]
                break;
            default:
                console.log("なにその引数\n俺知らないんだけど");
                process.exit();
                break;
        }

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
                const rmname = await question("削除したいエントリの名前は？: ");
                if (rmname) {
                    client.write(JSON.stringify({
                        datatype: "rm",
                        name: rmname,
                    }));
                    return true;
                } else {
                    console.log("名前入力されてなくない？");
                    process.exit();
                }
                // 削除の処理をここに追加
                break;
            case "list":
                // リストの処理をここに追加
                client.write(JSON.stringify({
                    datatype: "list",
                }));
                break;
            default:
                console.log("なにそれ～");
                process.exit();
                break;
        }
    }
}

entry();
