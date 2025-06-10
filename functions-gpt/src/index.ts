import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onValueWritten } from 'firebase-functions/v2/database';
import { setGlobalOptions } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();
admin.initializeApp();

// ---------- 공통 ----------
setGlobalOptions({ region: "asia-southeast1", memory: "2GiB", timeoutSeconds: 540 });

const firestore = admin.firestore();
const rtdb      = admin.database();
const storage   = admin.storage();
const openai    = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const normA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const normB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return dot / (normA * normB || 1);
}

// ----------------------------------------------------------------------------
// 1️⃣ 장애인 ➜ 비장애인 : 수어 단어 → 자연어 문장 (Firestore)
// ----------------------------------------------------------------------------
export const translateOnCreate = onDocumentCreated("predictions/{docId}", async (event) => {
  const snap = event.data;
  if (!snap) return;
  const { words, roomId } = snap.data() || {};
  if (!Array.isArray(words) || words.length === 0 || !roomId) return;

  const embed = await openai.embeddings.create({ model: "text-embedding-3-small", input: words.join(" ") });
  const userVec = embed.data[0].embedding;

  const docs: { sentence: string; word_list: string[]; score: number }[] = [];
  (await firestore.collection("embeddings1").get()).forEach(d => {
    const data = d.data();
    if (!data.embedding || !data.word_list || !data.sentence) return;
    docs.push({ sentence: data.sentence, word_list: data.word_list, score: cosineSimilarity(userVec, data.embedding) });
  });
  const top3 = docs.sort((a, b) => b.score - a.score).slice(0, 3);

  const prompt = `다음은 수어 단어들의 목록입니다: ${JSON.stringify(words)}.
이 단어들의 의미를 반영하여 **명확하고 자연스러운 한국어 문장 하나만** 작성해주세요.
아래는 유사한 의미를 가진 예시 문장들입니다. 다만 일부 문장에는 설명, 부가적인 표현, 메타 정보 등이 포함되어 있을 수 있으니 **의미 참고만 하되 절대 복사하거나 인용하지 마세요.**
유사 문장 예시:
${top3.map((d,i)=> `${i+1}. "${d.sentence}" - 관련 단어: ${JSON.stringify(d.word_list)}`).join("\n")}
- 참고 문장을 그대로 복사하거나, 없는 단어를 추가해 길게 늘어놓는 것도 피해주세요.  
- 수어 단어에 '?'가 포함되어 있다면, 문장 끝을 '~요?', '~인가요?'등으로 **질문형**으로 마무리해주세요.
- 단어 ‘몇분?’은 사람 수가 아닌 **시간 단위의 분** 을 의미하는 질문입니다.`;

  const chat = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "저는 귀가 들리지 않는 사용자를 위해 수어 단어를 자연어 문장으로 바꾸는 엔지니어입니다. 입력되는 수어단어들을 상황에 맞게 자연스러운 문장을 만들어주세요" },
      { role: "user",   content: prompt }
    ],
    temperature: 0.7,
  });
  const translated = chat.choices[0].message.content?.trim().replace(/^"+|"+$/g, "") || "";

  await firestore.collection("translations").doc(event.params.docId).set({
    original_words: words,
    translated_sentence: translated,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
  await rtdb.ref(`sign_input_disabled/${roomId}/result`).set({ translated_sentence: translated });

  console.log(`✅ 수어→문장 변환: ${translated}`);
});

// ----------------------------------------------------------------------------
// 2️⃣ 비장애인 ➜ 장애인 : 자연어 문장 → 수어 단어 + URL (Firestore)
// ----------------------------------------------------------------------------
export const processUserInput = onDocumentCreated("user_inputs/{docId}", async (event) => {
  const snap = event.data;
  if (!snap) return;
  const { sentence, roomId } = snap.data() || {};
  if (!sentence || !roomId) return;
  console.log("🟢 입력 문장:", sentence);

  const em = await openai.embeddings.create({ model: "text-embedding-3-small", input: sentence });
  const vec = em.data[0].embedding;

  const docs: { sentence: string; word_list: string[]; score: number }[] = [];
  (await firestore.collection("embeddings1").get()).forEach(d => {
    const data = d.data();
    if (!data.embedding || !data.sentence || !data.word_list) return;
    docs.push({ sentence: data.sentence, word_list: data.word_list, score: cosineSimilarity(vec, data.embedding) });
  });
  const top3 = docs.sort((a,b)=>b.score-a.score).slice(0,3);

  const prompt = `사용자 문장: \"${sentence}\"\n\n유사 문장들:\n${top3.map((d,i)=> `${i+1}. \"${d.sentence}\" - 단어들: ${JSON.stringify(d.word_list)}`).join("\n")}\n\n이 문장을 핵심적인 수어 단어만 추출해 배열로로 변환해줘. 
  조건1:출력은 반드시 JSON 배열 형식.
  조건2:문장의 핵심 의미를 구성하는 단어만 포함 (예: 주어, 동작, 장소, 대상 등)
  조건3:조사, 어미, 불필요한 연결어(예: "해서", "그리고", "그러니까")는 제외`;
  
  const gpt = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [ { role:"system", content:"수어 단어 추출 AI" }, { role:"user", content: prompt } ]
  });
  let finalWords: string[] = [];
  try {
    finalWords = JSON.parse(gpt.choices[0].message.content?.replace(/```json|```/g, "").trim() || "[]");
  } catch(e) {
    console.error("❌ GPT JSON 파싱 실패", e); return;
  }

  const urls: string[] = [];
  for (const w of finalWords) {
    try {
      const [url] = await storage.bucket().file(`sign_videos/${w}.mp4`).getSignedUrl({ action:"read", expires: Date.now()+3600_000 });
      urls.push(url);
    } catch(e) {
      console.error(`❌ ${w}.mp4 URL 실패`, e);
    }
  }

  await rtdb.ref(`sign_outputs/${roomId}/extracted_words`).set({ words: finalWords, urls, timestamp: Date.now() });
  console.log(`✅ 문장→단어: ${finalWords.join(", ")}`);
});

// ----------------------------------------------------------------------------
// 3️⃣ RTDB : URL 배열 → FFmpeg 병합 (concatVideos)
// ----------------------------------------------------------------------------
export const concatVideos = onValueWritten(
  '/sign_outputs/{roomId}/extracted_words',
  async (event) => {
    const after = event.data.after.val();
    if (!after?.urls?.length) {
      console.log('❌ 트리거됨 - URL 없음');
      return;
    }

    const { roomId } = event.params;
    console.log(`✅ concatVideos - roomId:${roomId}, 개수:${after.urls.length}`);

    const tmp = os.tmpdir();
    const files: string[] = [];

    // 1. Storage → tmp 다운로드
    for (let i = 0; i < after.urls.length; i++) {
      const fullUrl = after.urls[i];
      const gsPath = decodeURIComponent(
        fullUrl.replace(/^https:\/\/storage.googleapis.com\/[^/]+\//, '').split('?')[0]
      );
      const local = path.join(tmp, `clip_${i}.mp4`);
      try {
        await storage.bucket().file(gsPath).download({ destination: local });
        files.push(local);
        console.log(`⬇️ ok: ${gsPath}`);
      } catch (e) {
        console.error(`⚠️ 다운로드 실패: ${gsPath}`, e);
      }
    }
    if (!files.length) return console.log('❌ 다운로드 0');

    // 2. list.txt
    const listPath = path.join(tmp, 'list.txt');
    fs.writeFileSync(listPath, files.map((f) => `file '${f}'`).join('\n'));

    // 3. FFmpeg concat
    const output = path.join(tmp, 'combined.mp4');
    await new Promise((res, rej) => {
      const ff = spawn('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', output]);
      ff.stderr.on('data', (d) => console.log('📦', String(d)));
      ff.on('close', (c) => (c === 0 ? res(null) : rej(new Error(`ffmpeg exit ${c}`))));
    });

    // 4. 업로드 & v4 Signed-URL(24h)
    const dest = `combined_videos/${roomId}/${Date.now()}.mp4`;
    const bucketFile = storage.bucket().file(dest);
    await storage.bucket().upload(output, { destination: dest });

    const [signed] = await bucketFile.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 24 * 3600_000, // 24h
    });

    // 5. RTDB push → combined_urls 배열
    await rtdb
      .ref(`sign_outputs/${roomId}/combined_urls`)
      .push({ url: signed, ts: Date.now() });

    console.log('✅ combined_urls push 완료:', signed);

    // 6. tmp 정리
    [...files, listPath, output].forEach((f) => fs.unlinkSync(f));
  }
);