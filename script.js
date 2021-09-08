let localStream;
// カメラ映像取得
navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
})
  .then(stream => {
    // 成功時にvideo要素にカメラ映像をセットし、再生
    const videoElm = document.getElementById('my-video');
    videoElm.srcObject = stream;
    videoElm.play();
    // 着信時に相手にカメラ映像を返せるように、グローバル変数に保存しておく
    localStream = stream;
  }).catch(error => {
    // 失敗時にはエラーログを出力
    console.error('mediaDevice.getUserMedia() error:', error);
    alert('mediaDevice.getUserMedia() error:', error);
    return;
  });

let peer = new Peer({
  key: 'c1ff404a-1d46-40c8-a9b1-c6a74bdf07be',
  debug: 3
});


//PeerID取得
peer.on('open', () => {
  document.getElementById('my-id').textContent = peer.id;
});

let dataConnection;
let date = new Date();

//音声認識
SpeechRecognition = webkitSpeechRecognition || SpeechRecognition;
const rec = new SpeechRecognition();
rec.continuous = true;
rec.interimResults = true;
rec.lang = 'ja-JP'
let recognizing = true;;
// 字幕
let subtitles = "";
// let captioning = true;
// それらのボタン
const recognizingBtn = document.getElementById('recognizing-btn');
const subtitlesBtn = document.getElementById('subtitles-btn');
// recognizingBtn.value = "OFF";

// 音声合成
const uttr = new SpeechSynthesisUtterance();
// 言語 (日本語:ja-JP, アメリカ英語:en-US, イギリス英語:en-GB, 中国語:zh-CN, 韓国語:ko-KR)
uttr.lang = "ja-JP"
// それらのボタン
const synthesizeBtn = document.getElementById('synthesize-btn');

reset();
rec.onend = reset;

// 音声認識が停止したときに発動される(自動停止を防ぐ, これ自体はイベントハンドラではない)
function reset() {
  if (recognizing) {
    // alert(`勝手に終了しようとした\n recognizing: ${recognizing}`)
    rec.start()
  } else {
    recognizingBtn.value = "ON";
    final = "";
  }
}

// alert(">>音声認識 開始");

//イベントハンドラ(音声認識ボタン)//ボタン押下時に問題アリ?
function recStartStop() {
  if (recognizing) {
    rec.stop();
    recognizing = false;
    // alert(">>音声認識 終了");
    reset();
  } else {
    rec.stop();
    rec.start()
    recognizing = true;
    recognizingBtn.value = "OFF";
    // alert(">>音声認識 開始");
  }
  console.log(`音声認識: ${recognizing}`);
  // date = new Date();
  // alert(`${("0" + date.getHours()).slice(-2)}:${("0" + date.getMinutes()).slice(-2)}`)
}

//イベントハンドラ(読み上げボタン)*************************************************
function synStartStop() {
  if (!synthesizeBtn.checked) {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel()
    }
  }
}

//イベントハンドラ(字幕ボタン)*************************************************
function subStartStop(){
  if (subtitlesBtn.checked) {
    sendedSubtitles.textContent = "";
  }else{
    sendedSubtitles.innerHTML = "字幕機能はOFFになっています。<br>&ensp;設定 > 字幕機能";
  }
}

console.log(`音声認識: ${recognizing}`);
console.log(`字幕機能: ${subtitlesBtn.checked}`);
console.log(`読み上げ: ${synthesizeBtn.checked}`);

// テキストチャット
const localText = document.getElementById('send-messages');
const sendTrigger = document.getElementById('send-trigger');
const messages = document.getElementById('all-messages');
const sendedSubtitles = document.getElementById('sended-subtitles');
let connection = false;
// let theirID;

// 発信処理---------------------------------------------------------------------------------------
document.getElementById('make-call').onclick = () => {
  const theirID = document.getElementById('their-id').value;
  if (!connection) {
    if (!theirID == "") {
      alert("発信中");
      const mediaConnection = peer.call(theirID, localStream);
      setEventListener(mediaConnection);
    } else {
      alert("正しい相手方のIDを入力してください");
    }
  }
  //
  alert(connection);

  // テキストチャットの開室
  dataConnection = peer.connect(theirID);
  // データチャネルが接続されたとき
  dataConnection.once('open', async () => {
    messages.innerHTML += `=== チャットルームが開かれました(発信側) ===`;
    sendTrigger.addEventListener('click', onClickSend);
    // 非推奨のメソッドではあるが必要不可欠
    peer.disconnect();
    connection = true;
    alert(connection);
  });

  // 接続先の Peer からデータを受信したとき
  dataConnection.on('data', data => {
    if ("00" == data.substr(0, 2)) {
      if (subtitlesBtn.checked) {
        sendedSubtitles.textContent = data.substr(3);
      }
    } else if ("01" == data.substr(0, 2)) {
      date = new Date();
      messages.innerHTML += `<br>${("0" + date.getHours()).slice(-2)}:${("0" + date.getMinutes()).slice(-2)}  Remote:<br>&ensp;${data.substr(3)}`;
      uttr.text = data.substr(3);
      console.log(`uttr.text(発信側): ${uttr.text}`)
      if (synthesizeBtn.checked) {
        speechSynthesis.speak(uttr);
      }
    }
  });

  // DataConnection#close()が呼ばれたとき、または接続先 Peer とのデータチャネル接続が切断されたとき
  dataConnection.once('close', () => {
    messages.innerHTML += `=== チャットルームが閉じられました ===`;
    sendTrigger.removeEventListener('click', onClickSend);
    // peer = new Peer({
    //   key: 'c1ff404a-1d46-40c8-a9b1-c6a74bdf07be',
    //   debug: 3
    // });
    // peer.on('open', () => {
    //   document.getElementById('my-id').textContent = peer.id;
    // });
    // connection = false;
    // alert(connection);
    location.reload();
  });

  // メッセージを送信
  function onClickSend() {
    const data = "01:" + localText.value;
    dataConnection.send(data);
    date = new Date();
    messages.innerHTML += `<br>${("0" + date.getHours()).slice(-2)}:${("0" + date.getMinutes()).slice(-2)}  You   :<br>&ensp;${data.substr(3)}`;
    localText.value = '';
  }

  //字幕イベントハンドラ(確定する度)
  rec.onresult = e => {
    for (var i = e.resultIndex; i < e.results.length; i++) {
      if (!e.results[i].isFinal) continue
      const { transcript } = e.results[i][0]
      subtitles = transcript
      const data = "00:" + subtitles;
      dataConnection.send(data);
    }
  }
};

// 切断ボタン押下
document.getElementById('close-call').onclick = () => {
  if (connection) {
    // シグナリングサーバを含む全ての通信を切る
    peer.destroy();
  }else{
    alert("現在, 通信はしておりません");
  }
}

// イベントリスナを設置する関数
const setEventListener = mediaConnection => {
  mediaConnection.on('stream', stream => {
    // video要素にカメラ映像をセットして再生
    const videoElm = document.getElementById('their-video')
    videoElm.srcObject = stream;
    videoElm.play();
  });
}

//着信処理
peer.on('call', mediaConnection => {
  mediaConnection.answer(localStream);
  setEventListener(mediaConnection);
});

peer.on('error', err => {
  alert(err.message);
});

peer.on('close', () => {
  alert('通信を切断しました。');
});

// 着信側---------------------------------------------------------------------------------------
peer.on('connection', dataConnection => {
  dataConnection.on('open', () => {
    messages.innerHTML += `=== チャットルームが開かれました(着信側) ===`;

    sendTrigger.addEventListener('click', onClickSend);
    // 非推奨のメソッドではあるが必要不可欠
    peer.disconnect();
    connection = true;
    alert(connection);
  });

  // データを受信
  dataConnection.on('data', data => {
    if ("00" == data.substr(0, 2)) {
      if (subtitlesBtn.checked) {
        sendedSubtitles.textContent = data.substr(3);
        // sendedSubtitles.innerHTML = data.substr(3);
      }
    } else if ("01" == data.substr(0, 2)) {
      date = new Date();
      messages.innerHTML += `<br>${("0" + date.getHours()).slice(-2)}:${("0" + date.getMinutes()).slice(-2)}  Remote:<br>&ensp;${data.substr(3)}`;
      uttr.text = data.substr(3);
      console.log(`uttr.text(着信側): ${uttr.text}`)
      if (synthesizeBtn.checked) {
        speechSynthesis.speak(uttr);
      }
    }
  });

  dataConnection.once('close', () => {
    messages.innerHTML += `<br>=== チャットルームが閉じられました ===`;
    sendTrigger.removeEventListener('click', onClickSend);
    // peer = new Peer({
    //   key: 'c1ff404a-1d46-40c8-a9b1-c6a74bdf07be',
    //   debug: 3
    // });
    // peer.on('open', () => {
    //   document.getElementById('my-id').textContent = peer.id;
    // });
    // connection = false;
    // alert(connection);
    location.reload();
  });

  function onClickSend() {
    var data = "01:" + localText.value;
    dataConnection.send(data);
    date = new Date();
    messages.innerHTML += `<br>${("0" + date.getHours()).slice(-2)}:${("0" + date.getMinutes()).slice(-2)} You:<br>&ensp;${data.substr(3)}\n`;
    localText.value = '';
  }
  //字幕イベントハンドラ(確定する度)
  rec.onresult = e => {
    for (var i = e.resultIndex; i < e.results.length; i++) {
      if (!e.results[i].isFinal) continue
      const { transcript } = e.results[i][0]
      subtitles = transcript
      const data = "00:" + subtitles;
      dataConnection.send(data);
    }
  }
});

peer.on('error', console.error);
