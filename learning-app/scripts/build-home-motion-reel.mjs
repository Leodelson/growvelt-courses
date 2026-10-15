// Offline media build only. Usage: node scripts/build-home-motion-reel.mjs <ffmpeg> <source-directory>
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const [ffmpeg, sourceDirectory] = process.argv.slice(2);
if (!ffmpeg || !sourceDirectory) throw new Error("Provide FFmpeg and the directory containing the four approved Canva exports.");
const names = ["c7dc02e9-fab0-414a-90b9-2fd32d5087b4.mp4", "7ce52def-3864-4101-a318-b40da3ec678e.mp4", "uri_ifs___V_J6OQLw2sSvmEn-_r5hixzqkLXTpzIuB-RjkqkhTc5PE.mp4", "uri_ifs___V_LvS9Zc-0YwuYXUu6Rf2PSh_23l1epozZ2Y7etw1KOeg.mp4"];
const output = path.resolve("public/videos");
mkdirSync(output, { recursive: true });
const run = (args) => {
  const result = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "warning", "-y", ...args], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`FFmpeg exited ${result.status}`);
};
const normalize = (index, start, duration, label) => `[${index}:v]trim=start=${start}:duration=${duration},setpts=PTS-STARTPTS,${index === 0 ? "crop=iw:ih-84:0:84," : ""}scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=24,format=yuv420p,settb=AVTB[${label}]`;
const filters = names.map((_, index) => normalize(index, 0.4, 2.4, `v${index}`));
filters.push(normalize(4, 0, 0.4, "end"));
filters.push("[v0][v1]xfade=transition=fade:duration=0.4:offset=2[x1]", "[x1][v2]xfade=transition=fade:duration=0.4:offset=4[x2]", "[x2][v3]xfade=transition=fade:duration=0.4:offset=6[x3]", "[x3][end]xfade=transition=fade:duration=0.4:offset=8[out]");
run([...names.flatMap((name) => ["-i", path.join(sourceDirectory, name)]), "-i", path.join(sourceDirectory, names[0]), "-filter_complex", filters.join(";"), "-map", "[out]", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "25", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-t", "8.4", path.join(output, "growvelt-learning-reel-v1.mp4")]);
run(["-i", path.join(output, "growvelt-learning-reel-v1.mp4"), "-frames:v", "1", "-c:v", "libwebp", "-quality", "83", path.join(output, "growvelt-learning-reel-v1.webp")]);
