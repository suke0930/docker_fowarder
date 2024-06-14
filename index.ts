import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import net from 'net';
import fs, { readFileSync, writeFileSync } from 'fs';
import * as pty from 'node-pty'
import os from 'os'
interface portdata {
    name: string,
    lport: number,
    cport: number,
    ip: string,
    TCP: boolean,
    run?: boolean,
    err?: string,
    cid?: number,
    pid?: number,
    cli?: pty.IPty | null
};
const socketpath = "/tmp/portfowardsuke";
// const dockerProcess = spawn('docker-compose', ['-f', './dockercontainer/docker-compose.yml', 'up', '--build']);
class main {
    private daemon: ChildProcessWithoutNullStreams | null;
    private ready: boolean;
    private data: portdata[];
    private instance: portdata[];
    constructor() {
        this.data = JSON.parse(String(readFileSync("./portdata.json")));
        this.ready = false;
        this.instance = [];
        this.daemon = null;
        const alpha = spawn('docker-compose', ['-f', './dockercontainer/docker-compose.yml', 'down']);
        alpha.stdout.on('data', (data) => {
            console.log("alpha:" + data);
        });
        alpha.stderr.on('data', (data) => {
            console.error(String(data));
        });
        alpha.on('close', (code) => {
            console.log("alpha2:" + code);
            this.daemon = spawn('docker-compose', ['-f', './dockercontainer/docker-compose.yml', 'up']);
            this.daemon.stdout.on('data', (data) => {
                console.log(`stdout: ${data}`);
                if (String(data).indexOf("Entering") !== -1) {
                    console.log("デーモンは聖女です");
                    this.ready = true;
                    this.socketserver()
                    this.firstscan();
                }
            });

            this.daemon.stderr.on('data', (data) => {
                console.error(String(data));
            });
            this.daemon.on('close', (code) => {
                console.log(`デーモンは異常です ${code}`);
            });
        });

    }
    /**
     * ポートの割当を試してみるマン
     * @param portdata 
     * @returns 成功可否、エラー、インスタンス｜ぬるぽ
     */
    tryboot(portdata: portdata) {
        return new Promise<{ good: boolean, err: string, cli: pty.IPty | null }>((resolve) => {
            // boolean, string, ChildProcessWithoutNullStreams | null
            const shellpreset = os.platform() === 'win32' ? 'powershell.exe' : 'bash';//
            let command: string;
            if (portdata.TCP === true) {
                //TCPの場合
                command = "docker exec -it ubuntu_macvlan /home/nonroot/redir --lport=" + portdata.lport + " --cport=" + portdata.cport + " --caddr=" + portdata.ip + " ;exit"
            } else {
                //UDPの場合
                command = "docker exec -i ubuntu_macvlan /home/nonroot/uredir --lport=" + portdata.lport + " --cport=" + portdata.cport + " --caddr=" + portdata.ip + " ;exit"
            }
            const newspawn = pty.spawn(shellpreset, ["-c", command], {
                name: '(' + portdata.name + ')suke_portfoward',
                cols: 80,
                rows: 30,
                cwd: process.cwd(),
                env: process.env
            });
            let firstflag = true;
            let errlog = "";
            /**
             * 正常時の処理
             * tset
             */

            /**
             * メッセージ受信後の処理
             */
            function handleData(rawdata: any) {
                const data = String(rawdata);
                errlog = errlog + "\n" + data;
                console.log(portdata.name + ":" + String(rawdata));
                firstflag = false;
            };
            const errorchekcer = newspawn.onData((handleData));

            newspawn.onExit((data) => {
                console.log("tty has exit!", data)
                resolve({ good: false, err: errlog, cli: null })
            })
            // newspawn.stderr.on('data', (handleData));
            setTimeout(() => {
                errorchekcer.dispose();
                if (firstflag) {
                    resolve({ good: true, err: "", cli: newspawn })
                } else {
                    // resolve([false, errlog, null])
                    console.log("ここはやばい");
                    resolve({ good: false, err: errlog, cli: null })
                }
            }, 1000);

        })

    }
    /**
     * その名前の要素が存在しているかの確認
     * @param name 検索名
     * @returns -1なら存在しない　それ以外はある配列番号
     */
    checkarr(name: string) {
        return new Promise<number>((resolve) => {
            let result = -1;
            this.instance.map((elem, index) => {
                if (elem.name === name) {
                    result = index;
                }
            })
            resolve(result);
        })
    }

    /**
     * エラーを監視する
     * 場合によってはrun=false
     * @param data インスタンスの詳細
     * @param cli インスタンス本体
     */
    checkerr(data: portdata, cli: {
        good: boolean; err: string; cli: pty.IPty | null;
    }) {
        const handleData = async (data2: any) => {
            const resolve = await this.checkarr(data.name);
            if (resolve !== -1) {
                this.instance[resolve].err = this.instance[resolve].err + "\n" + String(data2)
            } else {
                console.log("はいれつが ないよ！")
            }
        }
        if (cli.cli) {
            const datalisner = cli.cli.onData(handleData);

            cli.cli.onExit(async (code) => {
                if (cli.cli) {
                    // cli.cli.stdout.removeAllListeners("data");
                    datalisner.dispose();
                    const resolve = await this.checkarr(data.name);
                    if (resolve !== -1) {
                        this.instance[resolve].err = this.instance[resolve].err + "\n" + "app is down! errcode:" + String(code);
                    } else {
                        console.log("はいれつが ないよ！")
                    }
                    /**
                     * エラー処理後の通知とか必要ならこの後に表記すること
                     */
                    this.instance[resolve].run = false;
                    // this.tryboot(data);
                }
            });
        } else {
            console.log("??????????????");

        }
    }

    /**
     * 保存したlistからプリセットをロードする
     * 初期化も兼ねてる。
     */
    firstscan() {
        this.instance = [];//初期化
        this.data.map(async (elem) => {
            const result = await this.tryboot(elem);
            let handlerwalter: portdata = {
                name: elem.name,
                lport: elem.lport,
                ip: elem.ip,
                cport: elem.cport,
                TCP: elem.TCP,
                err: "",
                run: false,
            }
            // console.log(result);
            if (result.good) {
                console.log("正常起動:" + elem.name);
                const ishas = await this.checkarr(elem.name);
                handlerwalter.run = true
                if (result.cli) {
                    if (ishas === -1) {
                        handlerwalter.cli = result.cli;
                        this.instance.push(handlerwalter);
                    } else {
                        this.instance[ishas].cli = result.cli;
                        this.instance[ishas].run = true;
                    }
                }

                if (result.cli) {
                    /**スキャンレポート */

                    this.checkerr(elem, result);
                }
            } else {
                console.log("エラー:" + elem.name);
                console.log("内容:" + result.err);
                const ishas = await this.checkarr(elem.name);
                handlerwalter.run = false;
                handlerwalter.err = result.err;
                if (ishas === -1) {
                    this.instance.push(handlerwalter);
                } else {
                    this.instance[ishas].run = false;
                    this.instance[ishas].err = elem.err;
                }
            }

        })
    }
    /**
     * 新しいエントリを追加する
     * @param elem 追加したいエントリの詳細
     * @returns 正常なら"OK"、エラーならその内容のstringを返す
     */
    async addnewcli(elem: portdata) {
        return new Promise<string>(async (resolve) => {
            const result = await this.tryboot(elem);
            let handlerwalter: portdata = {
                name: elem.name,
                lport: elem.lport,
                ip: elem.ip,
                cport: elem.cport,
                TCP: elem.TCP,
                err: "",
                run: false
            }
            // console.log(result);
            if (result.good) {
                console.log("正常起動:" + elem.name);
                const ishas = await this.checkarr(elem.name);
                handlerwalter.run = true
                if (result.cli) {
                    handlerwalter.cli = result.cli;
                }
                if (ishas === -1) {
                    this.instance.push(handlerwalter);
                } else {
                    if (result.cli) {
                        console.log("エントリあるよ");
                        this.instance[ishas].run = true;
                        this.instance[ishas].cli = result.cli;
                    }
                }
                if (result.cli) {
                    /**スキャンレポート */
                    this.checkerr(elem, result);
                    resolve("OK");
                }
            } else {
                //良くない場合
                console.log("エラー:" + elem.name);
                console.log("内容:" + result.err);
                // const ishas = await this.checkarr(elem.name);
                // handlerwalter.run = false;
                // handlerwalter.err = result.err;
                // if (ishas === -1) {
                //     this.instance.push(handlerwalter);
                // } else {
                //     this.instance[ishas].run = false;
                //     this.instance[ishas].err = elem.err;
                // }
                resolve(result.err);
            }
        })
    }
    /**
     * ソケット鯖を起動する
     * 届いた情報はなんとかして別の関数にすっとばす
     */
    socketserver() {

        interface sockettype {
            datatype: "add" | "rm" | "list"
            name?: string,
            TCP?: boolean
            ip?: string
            cport?: number
            lport?: number
        }
        // サーバーを設定
        const server = net.createServer((connection) => {
            console.log('[sock]connected.');

            connection.on('close', () => {
                console.log('[sock]disconnected.');
            });
            connection.on('data', async (rawdata) => {
                console.log("[sockdata]" + rawdata.toString());
                const data: sockettype = JSON.parse(String(rawdata));
                switch (data.datatype) {
                    case "add":
                        console.log("これはadd");
                        if (data.name) {
                            const ishavename = await this.checkarr(data.name);
                            if (ishavename === -1) {
                                if ((data.TCP) && (data.cport) && (data.lport) && (data.name) && (data.ip)) {
                                    const tryadddata: portdata = {
                                        name: data.name,
                                        TCP: data.TCP,
                                        ip: data.ip,
                                        cport: data.cport,
                                        lport: data.lport
                                    }
                                    const result = await this.addnewcli(tryadddata);
                                    if (result === "OK") {
                                        await this.savedata();
                                    }
                                    connection.write(result);
                                } else {
                                    //引数が足りない時
                                    connection.write("引数が足りないよ!");
                                }
                            } else {
                                connection.write("名前かぶってるよ");
                            }
                        }
                        break;
                    case "list":
                        connection.write(
                            JSON.stringify(
                                this.instance.map((elem) => {
                                    const anybuffer = JSON.parse(JSON.stringify(elem));
                                    anybuffer.cli = null;
                                    // console.log(anybuffer);
                                    return anybuffer;

                                })));
                        console.log("これはlist");
                        break;
                    case "rm":
                        console.log("これはrm");
                        if (data.name) {
                            const ishasins = await this.checkarr(data.name)
                            if (ishasins !== -1) {
                                //これrminstanceにエントリチェック入れたい意味なくね？;
                                console.log(await this.rminstance(data.name));
                                await this.savedata();
                                connection.write("エントリは正常に削除されました。");
                            } else {
                                connection.write("そんなエントリなくない？");
                            }
                        }

                        break;
                }
            });
            connection.on('error', (err) => {
                console.error(err.message);
            });
        });

        try {
            fs.unlinkSync('/tmp/portfowardsuke.sock');
        } catch (error) { }
        server.listen('/tmp/portfowardsuke.sock');
    }
    /**
     * インスタンスをこの世から抹消する子。
     * 特に深い理由はない（？）
     * @param name 消したいエントリの名前
     * @returns エラー　もしくは　"OK"
     */
    rminstance(name: string) {
        return new Promise<string>(async (resolve) => {
            try {
                if (name) {
                    const ishavename = await this.checkarr(name);
                    if (ishavename !== - 1) {
                        const buffpid = this.instance[ishavename];
                        if (buffpid.cli) {
                            buffpid.cli.write('\x03');
                            setTimeout(() => {
                                //消し飛ばしたデータ以外を配列にまとめる
                                const newdata = this.instance.filter((elem) => {
                                    if (elem.name !== name) {
                                        const elembuff = elem;
                                        elembuff.run = false;
                                        elembuff.err = "";
                                        return elembuff;
                                    } else {
                                        //何も出力しない
                                    }
                                })
                                this.instance = newdata;//配列を上書きする（!impotant）
                                //セーブ処理
                                resolve("OK");
                            }, 50);
                        } else {
                            console.log("pidはない");
                        }
                    } else {
                        //エントリないよ！
                        resolve("not found")
                    }
                } else {
                    console.log("なにこれ");
                    process.exit();
                }
            } catch (error) {
                resolve("エラー\n" + String(error));
            }
        })

    }
    /**
     * 名前の意味する通り
     * @returns 完了フラグ
     */
    savedata() {
        return new Promise<void>(async (resolve) => {
            const saveobj = this.instance.map((elem) => {
                const elembuff = elem;
                // elembuff.cli = null;
                return elembuff
            })
            try {
                const savedatabuff: portdata[] = JSON.parse(JSON.stringify(saveobj));
                savedatabuff.map((elem, index) => {
                    savedatabuff[index].cli = null;
                    savedatabuff[index].run = false;
                })
                await writeFileSync("./portdata.json", JSON.stringify(savedatabuff));
                console.log("セーブできたよ")
            } catch (error) {
                console.log("書き込みエラ-:" + String(error));
            }
            resolve();
        })
    }


    /**
     * インスタンスのリロード
     */
    reload() {
        return new Promise<void>(async (resolve, reject) => {
            await this.savedata();
            this.instance.map((elem, index) => {
                try {
                    if (elem.cli) {
                        elem.cli.write('\x03');
                    }
                } catch (error) {
                }
            })
            setTimeout(() => {

                this.firstscan()
                resolve()
            }, 100);
        })
    }
}

const maincli = new main();

