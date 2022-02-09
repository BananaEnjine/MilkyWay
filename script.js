/*---------------------------*
 |       グローバル変数       |
 *---------------------------*/
/* SkyWay Javascript SDK */
const API_KEY = 'c1ff404a-1d46-40c8-a9b1-c6a74bdf07be'; // API key: シグナリングサーバとの通信に必須
const DEBUG_LEVEL = 3; // デバッグレベル [NONE: 0, ERROR: 1, WARN: 2, FULL: 3]

let PEER = null; // peerオブジェクト(通信を接続する際に必要となるオブジェクト)
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


/* HTMLへの紐づけ */
const SUBTITLES_BUTTON = document.getElementById('subtitles-btn'); // チェックボックス"字幕機能"
const SYNTHESIS_BUTTON = document.getElementById('synthesize-btn'); // チェックボックス"音読機能"
const CONNECTION_BUTTON = document.getElementById('make-call'); // 接続ボタン
const DISCONNECTION_BUTTON = document.getElementById('close-call'); // 切断ボタン
const SEND_MESSAGE = document.getElementById('send-messages'); // チャットルームで送信する入力メッセージ
const SEND_BUTTON = document.getElementById('send-trigger"'); // 送信ボタン
const MESSAGE_LIST = document.getElementById('all-messages'); // テキストチャットでのメッセージ一覧
const SUBTITLES_TEXT = document.getElementById('sended-subtitles'); // 相手の音声を合成した字幕の文字列
// let theirID;


/*---------------------------*
 |       main function       |
 *---------------------------*/
/* 主にサイトの初期化を行う */
(async function main() { // 1つの即時関数をmain関数とする(デバイスの確認による遅延を防いで同期的な動きをするためにasync)
  let mediaDevices_flag = false; // デバイスへのアクセスができたか否か
  let speechRecognition_flag = false; // 音声認識のAPIがブラウザに対応しているか否か
  let recognition_flag = false; // 音声認識をしているか否か(音声認識のAPIがブラウザに対応していれば常にtrueの状態となる)

  mediaDevices_flag = await can_getMediaDevices(); // デバイスを確認する際に遅延が発生するためawait

  /* Web Speech APIについての対応確認と初期化 */
  if (mediaDevices_flag) { // 音声認識のAPIがブラウザに対応している場合
    if (speechRecognition_flag = can_SpeechRecognition()) {
      recognition_flag = setUp_SpeechRecognition(); // Web Speech APIに関するグローバル変数の初期化
    }

    PEER = make_PeerObject();
    setUp_EventHandler_skyway(PEER, DATA_CONNECTION);
  }

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
  RECOGNITION.onend = reset; // RECOGNITION.stop()がされたときに関数resrt()を呼び出す
  let recognition_flag = true;
  reset(recognition_flag); // 音声認識の自動停止を防ぐ

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
  console.log(`字幕機能: ${SUBTITLES_BUTTON.checked}`)
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
  console.log(`読み上げ: ${SYNTHESIS_BUTTON.checked}`)
}


/*---------------------------*
 |   SkyWay Javascript SDK   |
 *---------------------------*/
/**************************************************************
 *                   Peerオブジェクトの生成                    *
 **************************************************************/
function make_PeerObject() {
  /* オブジェクトを生成する(任意のPeerIDの設定も可能) */
  let peer = new Peer({
    key: API_KEY,
    debug: DEBUG_LEVEL
  });

  return peer;
}

/**************************************************************
 *                  通信に関するイベントリスナ                  *
 **************************************************************/
function setUp_EventHandler_skyway(peer, dataConnection) {
  /* peerオブジェクトの有無を調べる */
  if (peer != null) { // Peerオブジェクトが生成されているとき
    console.log("I make Peer Object and try connnecting with Signaling Server...");

    /* シグナリングサーバへの接続が成功したときのイベント */
    peer.on('open', () => {
      let peerID = peer.id; // PeerID(=電話番号)の取得
      document.getElementById('my-id').textContent = peerID; // htmlへの組み込み
      console.log("You succeed in connection with signaling server.");
      console.log(`Signaling server give you PeerID: ${peerID}.`);

      /* シグナリングサーバに接続しているPeerIDの取得 */
      peer.listAllPeers(list => {
        console.log(list);
      });
    });

    /* 自分が相手から着信したときのイベント */
    peer.on('call', mediaConnection => {
      mediaConnection.answer(LOCAL_STREAM);
      setPartnerVideo(mediaConnection); // 発信した相手の映像をhtmlへ反映する
      console.log("You are maked a call.");
    });

    /* 相手との接続が切断されたときのイベント */
    peer.on('close', () => {
      alert('通信が切断されました。');
      console.log("The connection is breaked.");
      // リロードするか否か......................................................................
    });

    /* データチャネルが接続されたとき */
    dataConnection.once('open', async () => {
      MESSAGE_LIST.innerHTML += `=== チャットルームが開かれました(発信側) ===`;
      SEND_BUTTON.addEventListener('click', onClickSend);
      peer.disconnect(); // シグナリングサーバとの通信を切断し, 混線を防ぐ
      CONNECTION = true;
      alert(CONNECTION);
    });

    /* 相手から字幕やチャットの文字列を受信したとき */
    dataConnection.on('data', data => {
      /* 受信した文字列を基に処理する文字列の初期化 */
      let str_type = data.substr(0, 2); // 受け取った文字列について文頭の2文字を取得する
      let str_main = data.substr(3); // 受け取った文字列について4文字目以降の文字を取得する

      /* 受信した文字列をタイプstr_typeで判別する */
      if ("00" == str_type) { // 受信した文字列が字幕のとき
        if (SUBTITLES_BUTTON.checked) { // 字幕機能がオンのとき
          SUBTITLES_TEXT.textContent = str_main; // 字幕を表示する
        }
      } else if ("01" == str_type) { // 受信した文字列がチャットのとき
        let date = new Date(); // 時間の取得
        /* チャット欄に反映する */
        MESSAGE_LIST.innerHTML += `<br>${("0" + date.getHours()).slice(-2)}:${("0" + date.getMinutes()).slice(-2)}  Remote:<br>&ensp;${str_main}`; // 文字列の作成

        
        SYNTHESIS.text = str_main;
        console.log(`SYNTHESIS.text(発信側): ${SYNTHESIS.text}`)
        if (SYNTHESIS_BUTTON.checked) {
          speechSynthesis.speak(SYNTHESIS);
        }
      }
    });

    // DataConnection#close()が呼ばれたとき、または接続先 Peer とのデータチャネル接続が切断されたとき
    dataConnection.once('close', () => {
      MESSAGE_LIST.innerHTML += `=== チャットルームが閉じられました ===`;
      SEND_BUTTON.removeEventListener('click', onClickSend);
      /* +++++++++++++++++++++++++++++++++++++++++++++++++ *
       * // 可能であれば以下の処理が好ましい                 *
       * 新しいPeerオブジェクトの生成;                      *
       * シグナリングサーバと接続を再開する;                 *
       * +++++++++++++++++++++++++++++++++++++++++++++++++ */
      location.reload(); // サイトをリロードし, 新しくpeerオブジェクトを生成してシグナリングサーバと通信を行う. 
    });

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
      } else if (error.type == "peer-unavailable") {
        alert("正しい相手方のIDを入力してください");
        let str1 = "You input wrong partner PeerID. ";
        let str2 = "Please tell me correct his PeerID. "
        console.log(`${str1}${str2}`);
      }
    });
  }
}


/**************************************************************
 *              接続ボタンに関するイベントハンドラ              *
 **************************************************************/
CONNECTION_BUTTON.onclick = () => { // 接続ボタンが押されたときに発火する
  if (PEER == null) { // シグナリングサーバとの接続ができていないとき
    alert("サーバーとの通信にトラブルが発生しているため, この操作は無効です。");
    console.log("Sorry, because of trouble you can not make call.");
  }
  else {
    const theirID = document.getElementById('their-id').value;
    if (CONNECTION) { // 既に相手と接続している場合は, この操作を無効にする
      console.log("Now, you are connecting with partner. So, you can not operate this button.");
      return;
    }
    else {
      console.log("Now, you do not connnect...");
      if (!theirID == "") {
        alert("発信中");
        /* 相手に発信し, テキストチャットの開室を試みる */
        const mediaConnection = PEER.call(theirID, LOCAL_STREAM); // 相手に発信する
        DATA_CONNECTION = PEER.connect(theirID); // テキストチャットの開室
        setPartnerVideo(mediaConnection); // 着信をうける相手の映像をhtmlへ反映する
        console.log("You try making call...");
      } else {
        alert("正しい相手方のIDを入力してください");
        let str1 = "You do not input partner PeerID. ";
        let str2 = "Please tell me correct his PeerID. "
        console.log(`${str1}${str2}`);
      }
    }




    // メッセージを送信
    function onClickSend() {
      const data = "01:" + SEND_MESSAGE.value;
      DATA_CONNECTION.send(data);
      let date = new Date();
      MESSAGE_LIST.innerHTML += `<br>${("0" + date.getHours()).slice(-2)}:${("0" + date.getMinutes()).slice(-2)}  You   :<br>&ensp;${data.substr(3)}`;
      SEND_MESSAGE.value = '';
    }

    //字幕イベントハンドラ(確定する度)
    RECOGNITION.onresult = e => {
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue
        const { transcript } = e.results[i][0]
        let subtitles = transcript; // 字幕の文字列
        const data = "00:" + subtitles;
        DATA_CONNECTION.send(data);
      }
    }
  }
};

// 切断ボタン押下
DISCONNECTION_BUTTON.onclick = () => {
  if (CONNECTION) {
    // シグナリングサーバを含む全ての通信を切る
    peer.destroy();
  } else {
    alert("現在, 通信はしておりません");
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

// 着信側---------------------------------------------------------------------------------------
peer.on('connection', DATA_CONNECTION => {
  DATA_CONNECTION.on('open', () => {
    MESSAGE_LIST.innerHTML += `=== チャットルームが開かれました(着信側) ===`;

    SEND_BUTTON.addEventListener('click', onClickSend);
    // 非推奨のメソッドではあるが必要不可欠
    peer.disconnect();
    CONNECTION = true;
    alert(CONNECTION);
  });

  // データを受信
  DATA_CONNECTION.on('data', data => {
    if ("00" == data.substr(0, 2)) {
      if (SUBTITLES_BUTTON.checked) {
        SUBTITLES_TEXT.textContent = data.substr(3);
        // SUBTITLES_TEXT.innerHTML = data.substr(3);
      }
    } else if ("01" == data.substr(0, 2)) {
      let date = new Date();
      MESSAGE_LIST.innerHTML += `<br>${("0" + date.getHours()).slice(-2)}:${("0" + date.getMinutes()).slice(-2)}  Remote:<br>&ensp;${data.substr(3)}`;
      SYNTHESIS.text = data.substr(3);
      console.log(`SYNTHESIS.text(着信側): ${SYNTHESIS.text}`)
      if (SYNTHESIS_BUTTON.checked) {
        speechSynthesis.speak(SYNTHESIS);
      }
    }
  });

  // DATA_CONNECTION.once('close', () => {
  //   MESSAGE_LIST.innerHTML += `<br>=== チャットルームが閉じられました ===`;
  //   SEND_BUTTON.removeEventListener('click', onClickSend);
  //   // peer = new Peer({
  //   //   key: 'c1ff404a-1d46-40c8-a9b1-c6a74bdf07be',
  //   //   debug: 3
  //   // });
  //   // peer.on('open', () => {
  //   //   document.getElementById('my-id').textContent = peer.id;
  //   // });
  //   // CONNECTION = false;
  //   // alert(CONNECTION);
  //   location.reload();
  // });

  function onClickSend() {
    let data = "01:" + SEND_MESSAGE.value;
    DATA_CONNECTION.send(data);
    let date = new Date();
    MESSAGE_LIST.innerHTML += `<br>${("0" + date.getHours()).slice(-2)}:${("0" + date.getMinutes()).slice(-2)} You:<br>&ensp;${data.substr(3)}\n`;
    SEND_MESSAGE.value = '';
  }
  //字幕イベントハンドラ(確定する度)
  RECOGNITION.onresult = e => {
    for (var i = e.resultIndex; i < e.results.length; i++) {
      if (!e.results[i].isFinal) continue
      const { transcript } = e.results[i][0]
      let subtitles = transcript; // 字幕の文字列
      const data = "00:" + subtitles;
      DATA_CONNECTION.send(data);
      console.log("You say, ");
      console.log(subtitles);
    }
  }
});
