/*---------------------------*
 |       グローバル変数       |
 *---------------------------*/
/* SkyWay Javascript SDK */
const API_KEY = 'abb19065-0c2f-4933-8fb3-a622659c258a'; // API key: シグナリングサーバとの通信に必須
const DEBUG_LEVEL = 3; // デバッグレベル [NONE: 0, ERROR: 1, WARN: 2, FULL: 3]

let PEER_VTR = null; // 既に存在するpeerIDを取得するための仮オブジェクト
let PEER_LIST = []; // 既に存在するpeerIDを格納する配列
let PEER = null; // peerオブジェクト(通信を接続する際に必要となるオブジェクト)
let PTR_NAME; // 通信相手のID
let DATA_CONNECTION = null; // テキストチャットのルームオブジェクト
let CONNECTION = false; // 相手と通信中か否か

/* デバイス */
let LOCAL_STREAM = null; // 映像と音声デバイス

/* 音声認識 */
let RECOGNITION = null; // 字幕を作成するオブジェクト
let SYNTHESIS = null; // 字幕を音読するオブジェクト

/* 一部の関数についての動作確認 */
const VALID = 0;
const INVALID = 1;


/* htmlへの紐づけ */
const MYNAME_TEXT = document.getElementById('my-id'); // 自分のニックネーム(peerID)
const DEFINE_BUTTON = document.getElementById('name-define'); // 決定ボタン
const PTR_TEXT = document.getElementById('their-id'); // 相手のニックネーム(peerID)
const CONNECTION_BUTTON = document.getElementById('make-call'); // 接続ボタン
const DISCONNECTION_BUTTON = document.getElementById('close-call'); // 切断ボタン
const SEND_MESSAGE = document.getElementById('send-messages'); // 送信するメッセージのテキストボックス
const SEND_BUTTON = document.getElementById('send-trigger'); // 送信ボタン
const MESSAGE_LIST = document.getElementById('all-messages'); // テキストチャットでのメッセージ一覧
const SUBTITLES_TEXT = document.getElementById('sended-subtitles'); // 字幕欄
const SUBTITLES_BUTTON = document.getElementById('subtitles-btn'); // チェックボックス"字幕機能"
const SYNTHESIS_BUTTON = document.getElementById('synthesize-btn'); // チェックボックス"音読機能"

/* htmlへのイベントリスナ */
DEFINE_BUTTON.addEventListener('click', get_MyPeer); // 決定ボタンを押したときに発火する
CONNECTION_BUTTON.addEventListener('click', connect); // 接続ボタンを押したときに発火する
DISCONNECTION_BUTTON.addEventListener('click', disconnect); // 切断ボタンを押したときに発火する
SEND_BUTTON.addEventListener('click', send_message); // 送信ボタンを押したときにメッセージを送る関数を発火する
SUBTITLES_BUTTON.addEventListener('click', make_subtitles); // チェックボックス"字幕機能" をクリックしたときに発火する
SYNTHESIS_BUTTON.addEventListener('click', make_speech); // チェックボックス"音読機能"


/*---------------------------*
 |       main function       |
 *---------------------------*/
/* 主にサイトの初期化を行う */
(async function main() { // 1つの即時関数をmain関数とする(デバイスの確認による遅延を防いで同期的な動きをするためにasync)
  let mediaDevices_flag = false; // デバイスへのアクセスができたか否か

  mediaDevices_flag = await can_getMediaDevices(); // デバイスを確認する際に遅延が発生するためawait

  /* Web Speech APIについての対応確認と初期化 */
  if (mediaDevices_flag) { // 音声認識のAPIがブラウザに対応している場合
    if (speechRecognition_flag = can_SpeechRecognition()) {
      recognition_flag = setUp_SpeechRecognition(); // Web Speech APIに関するグローバル変数の初期化
    }
  }

  PEER_VTR = make_PeerObject(""); // 既存のpeerIDを取得するための仮PEERオブジェクトを生成する
  setUp_EventHandler_peer(PEER_VTR, "dis"); // シグナリングサーバのみの通信を行う旨で初期化

}());

/*---------------------------*
 |       デバイスの取得       |
 *---------------------------*/
/**************************************************************
 *                      通信デバイスの取得                     *
 **************************************************************/
async function can_getMediaDevices() {
  let promise, result;

  promise = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }) // カメラとマイクの許可を求める
    .then(stream => { // デバイスの取得に成功したとき
      const videoElm = document.getElementById('my-video'); // htmlのvideo要素への組み込み
      LOCAL_STREAM = stream; // 通信で送信する映像・音声の情報
      videoElm.srcObject = LOCAL_STREAM; // htmlに映像を組み込む
      videoElm.play(); // カメラを再生する
      // 着信時に相手にカメラ映像を返せるように、グローバル変数に保存しておく
      console.log("You allow the use of camera and microphone.");
      result = 1;
    })
    .catch(error => { // デバイスの取得に失敗したとき
      const str1 = 'カメラ, あるいはマイクが取得できませんでした。';
      const str2 = 'サービスをご利用される際にはこれらのアクセスを許可してください。';
      alert(`${str1}\n${str2}`); // ブラウザ上で失敗の旨とデバイス取得の許可を促す
      console.log('You do not allow the use of camera and microphone.');
      result = 0;
    });

  return result;
}


/*---------------------------*
 |   SkyWay Javascript SDK   |
 *---------------------------*/
/**************************************************************
 *                   自身のPeerオブジェクトの生成               *
 **************************************************************/
async function get_MyPeer() {
  if (PEER == null) {
    let peer_id = MYNAME_TEXT.value;

    /* シグナリングサーバに接続しているPeerIDの取得 */
    if (PEER_VTR != null) {
      await PEER_VTR.listAllPeers(list => {
        PEER_LIST = list;
      });
      // console.log(`list : ${PEER_LIST}`);
    }

    if (peer_id == "") {                        // 何も入力されていないとき
      alert("ニックネームを入力してください。");
      console.log("You failed make your Peer object!");
    } else if (PEER_LIST.includes(peer_id) == true) { // 入力されたIDが既存のものであるとき
      MYNAME_TEXT.value = "";
      alert("現在, そのニックネームは使用されています。");
      console.log("You failed make your Peer object!");
    } else if (peer_id.match(/[^A-Za-z0-9]+/)) { // 半角英数ではないとき
      MYNAME_TEXT.value = "";
      alert("半角英数で入力してください。");
      console.log("You failed make your Peer object!");
    } else {
      let str1 = "ニックネームが作成されました。";
      let str2 = "発信する方はお相手のニックネームを入力してください。";
      let str3 = "着信する方はお相手がご自身のニックネームを入力するまでお待ちください。";
      alert(`${str1}\n\n${str2}\n${str3}`);
      console.log("You succed make your Peer object!");
      PEER_VTR.destroy(); // 仮オブジェクトによるシグナリングサーバの通信を切断
      PEER_VTR = null; // 仮オブジェクトの無効化
      PEER = make_PeerObject(peer_id); // 通信に使用する自分のpeerオブジェクトを取得する
      setUp_EventHandler_peer(PEER, "con");
    }
  } else {
    alert("既にニックネームが作成されています。\nニックネームを変更されたい場合はページをリロードしてください。")
  }
}

MYNAME_TEXT.innerHTML = '<p>fire</p>';

/**************************************************************
*                   Peerオブジェクトの生成                    *
**************************************************************/
function make_PeerObject(id_name) {
  /* オブジェクトを生成する(任意のPeerIDの設定も可能) */
  let peer = new Peer(id_name, {
    key: API_KEY,
    debug: DEBUG_LEVEL
  });
  return peer;
}

/**************************************************************
 *              相手との通信に関するイベントリスナ              *
 **************************************************************/
function setUp_EventHandler_peer(peer, type) { // boo: サーバのみとの接続の場合は"dis", 相手との接続を行う場合は"con"
  /* peerオブジェクトの有無を調べる */
  if (peer != null) { // オブジェクトが生成されているとき
    console.log("I make Peer Object and try connnecting with Signaling Server...");

    /* シグナリングサーバへの接続が成功したときのイベント */
    peer.on('open', () => {
      let peerID = peer.id; // PeerID(=電話番号)の取得

      console.log("You succeed in connection with signaling server.");
      console.log(`Signaling server give you PeerID: ${peerID}.`);

      if (type == "con") {
        MYNAME_TEXT.textContent = peerID; // htmlへの組み込み
        console.log("This connection is practical.");
      } else if (type == "dis") {
        /* シグナリングサーバに接続しているPeerIDの取得 */
        peer.listAllPeers(list => {
          PEER_LIST = list;
          console.log(`PEER_LIST: ${PEER_LIST}`);
        });
        console.log("This connection is virtual.");
      }
    });

    /* シグナリングサーバとの接続を切断したときのイベント */
    peer.on('disconnected', () => {
      console.log(`You disconnect with signaling server.`);
    });

    if (type == "con") {
      /* 自分が相手から着信したときのイベント */
      peer.on('call', mediaConnection => {
        PTR_NAME = mediaConnection.remoteId; // 着信した相手のpeerIDの取得
        alert(`${PTR_NAME}さんから着信しました。`)
        mediaConnection.answer(LOCAL_STREAM);
        setPartnerVideo(mediaConnection); // 発信した相手の映像をhtmlへ反映する
        console.log("You are maked a call.");
      });

      /* 自分が相手からチャットを開かれたときのイベント */
      peer.on('connection', dataConnection => {
        DATA_CONNECTION = dataConnection;
        setUp_EventHandler_dataConnection(PEER, DATA_CONNECTION);

      });

      /* 相手との接続が切断されたときのイベント */
      peer.on('close', () => {
        console.log("The connection is breaked.");
      });
    }

    /* 何らかの不具合が生じたときのイベント */
    peer.on('error', function (error) {
      console.warn(`ERROR: ${error.type}\n  ${error.message}`);

      /* 不具合に対する処理 */
      if (error.type == "invalid-key") { // シグナリングサーバとの接続に失敗したとき
        PEER = null; // peerオブジェクトの無効化

        let str1 = "シグナリングサーバーとの接続に失敗しました。";
        let str2 = "ただいま, サービスのメンテナンス中です。"
        alert(`${str1}\n${str2}`);
        console.log("Sorry, You can not connect signaling server.");
      } else if (error.type == "peer-unavailable") { // 接続しようとした相手のIDが誤っているとき
        alert("正しい相手方のIDを入力してください");
        console.log("You input wrong partner PeerID. Please tell me correct his PeerID. ");
      } else if (error.type == "unavailable-id") {
        alert("現在, そのニックネームは使用されています。\nページをリロードします。");
        console.log("You failed make your Peer object!");
        location.reload(); // サイトをリロードする
      }
    });
  } else {
    console.log("I do not make Peer Object. So, I can not try connnecting with Signaling Server!");
  }
}

/**************************************************************
 *             チャットルームに関するイベントリスナ             *
 **************************************************************/
function setUp_EventHandler_dataConnection(peer, dataConnection) {
  /* dataConnectionオブジェクトの有無を調べる */
  if (dataConnection != null) { // チャットルームのオブジェクトが生成されているとき
    console.log("You can make dataConnection Object");

    /* データチャネルが接続されたとき */
    dataConnection.once('open', async () => {
      MESSAGE_LIST.innerHTML += `=== チャットルームが開かれました===`;
      peer.disconnect(); // シグナリングサーバとの通信を切断し, 混線を防ぐ
      CONNECTION = true; // 相手との通信を開始した旨を記録する
      console.log("Now, you succeed connection with partner. Good luck communication!");
    });

    /* 相手から字幕やチャットの文字列を受信したとき */
    dataConnection.on('data', data => {
      /* 受信した文字列を基に処理する文字列の初期化 */
      let str_type = data.substr(0, 2); // 受け取った文字列について文頭の2文字を取得する
      let str_main = data.substr(3); // 受け取った文字列について4文字目以降の文字を取得する

      console.log(`Your partner send you message, It is "${data}."`);
      /* 受信した文字列をタイプstr_typeで判別する["00": 字幕, "01": チャット] */
      if ("00" == str_type) { // 受信した文字列が字幕のとき
        if (SUBTITLES_BUTTON.checked) { // 字幕機能がオンのとき
          SUBTITLES_TEXT.textContent = str_main; // 字幕を表示する
          console.log("Its type is subtitles. So, I show message on subtitles box. ");
        }
      } else if ("01" == str_type) { // 受信した文字列がチャットのとき
        /* 時間の取得 */
        let date = new Date(); // 時間オブジェクトの生成
        let hour = ("0" + date.getHours()).slice(-2);
        let minute = ("0" + date.getMinutes()).slice(-2);

        /* チャット欄に反映する */
        MESSAGE_LIST.innerHTML += `<br>${hour}:${minute}  ${PTR_NAME}:<br>&ensp;${str_main}`; // 文字列の作成
        console.log("Its type is chat. So, I show message on chat box. ");

        /* 音読機能 */
        if (SYNTHESIS_BUTTON.checked) { // 音読機能がオンになっているとき
          SYNTHESIS.text = str_main; // 読み上げる文字列を設定する
          speechSynthesis.speak(SYNTHESIS); // チャットメッセージを読み上げる
          console.log(`And, I speak message sended by partner. It is "${SYNTHESIS.text}."`);
        }
      }
    });

    /* DataConnection#close()が呼ばれたとき, または接続先 Peer とのデータチャネル接続が切断されたとき */
    dataConnection.once('close', () => {
      MESSAGE_LIST.innerHTML += `=== チャットルームが閉じられました ===`;
      // SEND_BUTTON.removeEventListener('click', send_message);
      /* +++++++++++++++++++++++++++++++++++++++++++++++++ *
       * 新しいPeerオブジェクトの生成;                      *
       * シグナリングサーバと接続を再開する;                 *
       * +++++++++++++++++++++++++++++++++++++++++++++++++ */
      alert("相手との通信が途絶えました。ウェブページをリロードします。");
      location.reload(); // サイトをリロードし, 新しくpeerオブジェクトを生成してシグナリングサーバと通信を行う. 
    });
  }
}

/**************************************************************
 *                        相手に発信する                       *
 **************************************************************/
function connect() { // 接続ボタンを押したときに発火する
  if (PEER == null) { // シグナリングサーバとの接続ができていないとき
    alert("サーバーとの通信にトラブルが発生しているため, この操作は無効です。");
    console.log("Sorry, because of trouble you can not make call.");
  }
  else {
    if (CONNECTION) { // 既に相手と接続している場合は, この操作を無効にする
      alert("既に接続しています。通信を終えたいときは切断ボタンを押してください。");
      console.log("Now, you are connecting with partner. So, you can not operate this button.");
      return;
    }
    else {
      PTR_NAME = PTR_TEXT.value;
      console.log("You do not connnect.");
      if ((!PTR_NAME == "") && (PTR_NAME != PEER.id)) {
        alert("発信中");
        /* 相手に発信し, テキストチャットの開室を試みる */
        const mediaConnection = PEER.call(PTR_NAME, LOCAL_STREAM); // 相手に発信する
        DATA_CONNECTION = PEER.connect(PTR_NAME); // テキストチャットの開室
        setUp_EventHandler_dataConnection(PEER, DATA_CONNECTION);
        setPartnerVideo(mediaConnection); // 着信をうける相手の映像をhtmlへ反映する
        console.log("You try making call...");
      } else {
        alert("正しい相手方のIDを入力してください");
        let str1 = "You do not input partner PeerID. ";
        let str2 = "Please tell me correct his PeerID. "
        console.log(`${str1}${str2}`);
      }
    }


  }
}

// イベントリスナを設置する関数
const setPartnerVideo = mediaConnection => {
  mediaConnection.on('stream', stream => {
    // video要素にカメラ映像をセットして再生
    const videoElm = document.getElementById('their-video')
    videoElm.srcObject = stream;
    videoElm.play();
  });
}

/**************************************************************
 *                    相手との通信を切断する                   *
 **************************************************************/
function disconnect() {
  if (CONNECTION) {
    PEER.destroy(); // シグナリングサーバを含む全ての通信を切る
  } else {
    alert("現在, 通信はしておりません");
  }
}

/**************************************************************
 *                 チャットのメッセージを送る                  *
 **************************************************************/
function send_message() { // 送信ボタンを押したときに発火する
  if (PEER == null) {
    alert("サーバーとの通信にトラブルが発生しているため, この操作は無効です。");
    console.log("Sorry, because of trouble you can not make call.");
    return;
  } else if (DATA_CONNECTION == null) {
    alert("相手との通信がないため, この操作は無効です。");
    console.log("Sorry, because of no connection with partner you can not send message.");
    return;
  }

  let message = SEND_MESSAGE.value; // 自分が相手に送るメッセージの文字列を取得する
  const data = "01:" + message; // チャットであることを示すタイプを文字列に加える
  DATA_CONNECTION.send(data); // 相手に送信する

  /* 時間の取得 */
  let date = new Date(); // 時間オブジェクトの生成
  let hour = ("0" + date.getHours()).slice(-2);
  let minute = ("0" + date.getMinutes()).slice(-2);

  MESSAGE_LIST.innerHTML += `<br>${hour}:${minute}  ${PEER.id}   :<br>&ensp;${message}`; // チャット欄に反映する

  SEND_MESSAGE.value = ''; // 入力欄の初期化
}

/*-------------------------------*
 | Web Speech API(音声認識・合成) |
 *-------------------------------*/
/**************************************************************
 *       APIが使用しているブラウザに対応しているかを調べる       *
 **************************************************************/
function can_SpeechRecognition() {
  /* ChromeとFirefoxの両方に対応させる */
  SpeechRecognition = webkitSpeechRecognition || SpeechRecognition;

  /* 使用しているブラウザの対応確認 */
  if ('SpeechRecognition' in window) { // ブラウザがAPIに対応しているとき
    console.log("Your browser is supported by Web Speech API");

    return 1;
  } else { // ブラウザがAPIに対応していないとき
    alert("お使いのブラウザは音声合成に対応していません。")
    console.log("Your browser is not supported by Web Speech API");

    return 0;
  }
}

/**************************************************************
 *            音声処理に関するグローバル変数の初期化            *
 **************************************************************/
function setUp_SpeechRecognition() {
  /* 音声認識: 字幕として文字列を作成する */
  RECOGNITION = new SpeechRecognition(); // 音声認識オブジェクトの生成
  RECOGNITION.continuous = true; // 継続的な音声認識の設定
  RECOGNITION.interimResults = false; // 認識途中の結果を取得するか否か
  RECOGNITION.lang = 'ja-JP' // 認識する言語の設定 [日本語:ja-JP, アメリカ英語:en-US, イギリス英語:en-GB, 中国語:zh-CN, 韓国語:ko-KR]  
  RECOGNITION.onend = reset; // 音声認識が終了したときのイベントリスナ(reset関数を発火させる)
  let recognition_flag = true;
  reset(recognition_flag); // 音声認識の自動停止を防ぐ

  /* 字幕の生成が確定する度に発火するイベントハンドラ（字幕機能） */
  RECOGNITION.onresult = e => {
    for (var i = e.resultIndex; i < e.results.length; i++) {
      if (!e.results[i].isFinal) continue
      const { transcript } = e.results[i][0]
      let subtitles = transcript; // 生成された文字列を受け取る

      console.log(`I understand that what you speak. It is "${subtitles}."`);

      if (CONNECTION == true) {
        const data = "00:" + subtitles; // 字幕であることを示すタイプを文字列に加える
        DATA_CONNECTION.send(data); // 相手に送信する

        console.log(`I send this message to your partner as subtitles. `);
      }
    }
  }

  /* 音声合成: 相手が送信したテキストチャットの文字列を音読する */
  SYNTHESIS = new SpeechSynthesisUtterance(); // 音声合成オブジェクトの生成
  SYNTHESIS.lang = "ja-JP" // 合成する言語の設定 [日本語:ja-JP, アメリカ英語:en-US, イギリス英語:en-GB, 中国語:zh-CN, 韓国語:ko-KR]

  return recognition_flag;
}

/**************************************************************
 *                    音声認識の自動停止を防ぐ                 *
 **************************************************************/
function reset(recognition_flag) {
  if (recognition_flag) { // 音声認識のフラグをtureに設定しているとき
    console.log("I continue speech recognition.");
    RECOGNITION.start()
  } else {// 音声認識のフラグをfalseに設定しているとき(今回は異常な処理となる)
    final = "";
    console.error("Now, I finish speech recognition.");
  }
}

/**************************************************************
 *       字幕機能のチェックボックスに関するイベントハンドラ      *
 **************************************************************/
function make_subtitles() {
  if (SUBTITLES_BUTTON.checked) {
    SUBTITLES_TEXT.textContent = "";
  } else {
    SUBTITLES_TEXT.innerHTML = "字幕機能はOFFになっています。<br>&ensp;設定 > 字幕機能";
  }
  console.log(`The checkbox of subtitles is clicked: Its value is ${SUBTITLES_BUTTON.checked}.`);
}

/**************************************************************
 *       音読機能のチェックボックスに関するイベントハンドラ      *
 **************************************************************/
function make_speech() {
  if (!SYNTHESIS_BUTTON.checked) { // 音読機能のチェックが外されたとき
    if (speechSynthesis.speaking) { // 音読中のとき(speechSynthesisはネイティブ?)
      speechSynthesis.cancel(); // 音読を中断する
    }
  }
  console.log(`The checkbox of speeching is clicked: Its value is ${SYNTHESIS_BUTTON.checked}.`);
}
