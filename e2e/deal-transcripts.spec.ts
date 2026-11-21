import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll, openDemo } from "./helpers";
import { localDemoFixtures } from "./local-demo-fixtures";
const envFile = process.env.CLIMBOS_DESIGN_E2E_ENV_FILE;
const { rows, cli } = localDemoFixtures(envFile);

test("owner imports permissioned text, reviews and removes it without AI or customer actions @mobile", async ({ page, baseURL }, testInfo) => {
  test.skip(!envFile, "Requires isolated loopback fixtures"); test.setTimeout(180000);
  expect(baseURL).toBe("http://127.0.0.1:3420");
  const slug = await openDemo(page), org = (await rows("organizations")).find(row => row.slug === slug)!;
  const member = (await rows("memberships")).find(row => row.orgId === org._id)!;
  const identity = JSON.stringify({ subject: `${member.userId}|transcript-fixture`, tokenIdentifier: "test|transcript-fixture" });
  const id = JSON.parse(await cli(["run", "crm:create", JSON.stringify({ slug, name: "Transcript customer", stage: "talking" }), "--identity", identity]));
  const effects = async () => Promise.all(["climbMessages", "workflowRuns", "approvals", "actionReceipts", "emailLog"].map(async table => (await rows(table)).filter(row => row.orgId === org._id)));
  const before = await effects(), errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto(`/app/${slug}/pipeline`); await page.getByRole("button", { name: /Transcript customer/ }).click();
  const sheet = page.getByRole("dialog", { name: "Transcript customer", exact: true });
  await sheet.getByText("Conversation transcripts", { exact: true }).click();
  await expect(sheet.getByText("No transcript imported. Conversation evidence stays unknown.", { exact: true })).toBeVisible();
  await sheet.getByRole("button", { name: "Import transcript", exact: true }).click();
  const form = sheet.getByRole("region", { name: "Import conversation transcript", exact: true });
  await form.getByLabel("Transcript title", { exact: true }).fill("Discovery excerpt");
  await form.getByLabel("Transcript source", { exact: true }).fill("Synthetic owner-prepared transcript");
  const text = "Buyer: We need help exporting data. Seller: What is blocking you? Buyer: I have not tested this product yet.";
  await form.getByLabel("Import a text file (optional)", { exact: true }).setInputFiles({ name: "synthetic.txt", mimeType: "text/plain", buffer: Buffer.from(text) });
  await expect(form.getByLabel("Reviewed transcript text", { exact: true })).toHaveValue(text);
  await form.getByLabel("Permission basis", { exact: true }).fill("Synthetic fixture approved for local checks");
  await expect(form.getByRole("button", { name: "Save transcript", exact: true })).toBeDisabled();
  await form.getByRole("checkbox", { name: "I have permission to store and use this transcript for business analysis", exact: true }).check();
  await form.getByRole("button", { name: "Save transcript", exact: true }).click();
  const record = sheet.getByRole("region", { name: "Discovery excerpt", exact: true });
  await expect(record.getByText(/Conversation date: Unknown/)).toBeVisible();
  await record.getByRole("button", { name: "Read transcript", exact: true }).click();
  await expect(record.getByText(text, { exact: true })).toBeVisible();
  await expectAccessible(page, "Imported transcript review"); await expectNoHorizontalScroll(page);
  await record.scrollIntoViewIfNeeded(); await page.screenshot({ path: testInfo.outputPath("transcript-review.png"), fullPage: false });
  await sheet.getByRole("button", { name: "Review next step", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Message Climb AI", exact: true })).toHaveValue(/imported transcripts/);
  expect(await effects()).toEqual(before);
  await page.getByRole("button", { name: "Close Climb AI", exact: true }).click();
  await page.goto(`/app/${slug}/pipeline`); await page.getByRole("button", { name: /Transcript customer/ }).click();
  await sheet.getByText("Conversation transcripts", { exact: true }).click();
  await record.getByRole("button", { name: "Remove transcript", exact: true }).click();
  await page.getByRole("alertdialog", { name: "Remove this transcript?", exact: true }).getByRole("button", { name: "Remove transcript", exact: true }).click();
  await expect(sheet.getByText("No transcript imported. Conversation evidence stays unknown.", { exact: true })).toBeVisible();
  expect((await rows("deals")).find(row => row._id === id)).toMatchObject({ stage: "talking", transcriptRevision: 2 });
  expect((await rows("dealTranscripts")).filter(row => row.dealId === id)).toEqual([]);
  expect(await effects()).toEqual(before); expect(errors).toEqual([]);
});

test("local microphone capture and device-only transcription require explicit consent @mobile", async ({ page, baseURL }) => {
  test.skip(!envFile, "Requires isolated loopback fixtures");
  test.setTimeout(180000);
  expect(baseURL).toBe("http://127.0.0.1:3420");
  const slug = await openDemo(page);
  const org = (await rows("organizations")).find(row => row.slug === slug)!;
  const member = (await rows("memberships")).find(row => row.orgId === org._id)!;
  const identity = JSON.stringify({ subject: `${member.userId}|capture-test`, tokenIdentifier: "test|capture-test" });
  const deal = JSON.parse(await cli(["run", "crm:create", JSON.stringify({ slug, name: "Capture fixture" }), "--identity", identity]));
  await page.addInitScript(() => {
    const state = { requests: 0, audioBytes: 0, localStarts: 0, deviceReady: false, track: null as MediaStreamTrack | null };
    Object.assign(window, { captureFixture: state });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: async () => {
      state.requests++;
      const context = new AudioContext();
      await context.resume();
      const target = context.createMediaStreamDestination();
      const source = context.createOscillator();
      source.connect(target);
      source.start();
      state.track = target.stream.getAudioTracks()[0];
      return target.stream;
    } });
    const Recorder = MediaRecorder;
    window.MediaRecorder = class extends Recorder {
      constructor(stream: MediaStream, options?: MediaRecorderOptions) {
        super(stream, options);
        this.addEventListener("dataavailable", event => { state.audioBytes += event.data.size; });
      }
    };
    class SpeechFixture {
      private local = false;
      get processLocally() { return this.local; }
      set processLocally(value: boolean) { this.local = value; }
      static async available(opts: { processLocally: boolean }) {
        if (!opts.processLocally) throw new Error("Cloud recognition is forbidden in this test.");
        return state.deviceReady ? "available" : "unavailable";
      }
      onresult?: (e: unknown) => void;
      onend?: () => void;
      start() {
        if (!this.local) throw new Error("On-device recognition required");
        state.localStarts++;
        this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "Synthetic words from the local device." } }] });
      }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    }
    Object.defineProperty(window, "SpeechRecognition", { value: SpeechFixture });
  });
  await page.goto(`/app/${slug}/pipeline`);
  await page.getByRole("button", { name: "Capture fixture" }).click();
  const sheet = page.getByRole("dialog", { name: "Capture fixture" });
  await sheet.getByText("Conversation transcripts", { exact: true }).click();
  await sheet.getByRole("button", { name: "Import transcript", exact: true }).click();
  const audio = sheet.getByRole("button", { name: "Record microphone audio" });
  const transcribe = sheet.getByRole("button", { name: "Transcribe on this device" });
  await expect(audio).toBeDisabled();
  await expect(transcribe).toBeDisabled();
  await sheet.getByRole("checkbox", { name: /Everyone whose voice/ }).check();
  await transcribe.click();
  await expect(sheet.getByText(/On-device transcription is unavailable/)).toBeVisible();
  const state = () => page.evaluate(() => {
    const s = (window as unknown as { captureFixture: { requests: number; localStarts: number; track: MediaStreamTrack | null } }).captureFixture;
    return { requests: s.requests, starts: s.localStarts, track: s.track?.readyState };
  });
  expect(await state()).toMatchObject({ requests: 0, starts: 0 });
  await audio.click();
  await expect(sheet.getByText("Microphone recording is active.")).toBeVisible();
  await page.waitForFunction(() => (window as unknown as { captureFixture: { audioBytes: number } }).captureFixture.audioBytes > 0);
  await sheet.getByRole("button", { name: "Stop capture" }).click();
  await expect(sheet.getByRole("link", { name: "Download audio" })).toHaveAttribute("href", /^blob:/);
  expect(await state()).toMatchObject({ requests: 1, track: "ended" });
  await sheet.getByRole("button", { name: "Discard audio" }).click();
  await page.evaluate(() => { (window as unknown as { captureFixture: { deviceReady: boolean } }).captureFixture.deviceReady = true; });
  await transcribe.click();
  await expect(sheet.getByText("On-device transcription is active.")).toBeVisible();
  await sheet.getByRole("button", { name: "Stop capture" }).click();
  await sheet.getByRole("button", { name: "Add words to transcript draft" }).click();
  await expect(sheet.getByLabel("Reviewed transcript text", { exact: true })).toHaveValue("Synthetic words from the local device.");
  await expect(sheet.getByRole("button", { name: "Save transcript" })).toBeDisabled();
  expect(await state()).toMatchObject({ requests: 1, starts: 1 });
  expect((await rows("dealTranscripts")).filter(row => row.dealId === deal)).toEqual([]);
});
