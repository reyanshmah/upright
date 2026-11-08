import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>Upright</h1>
      <p>
        A 10-minute home fall-risk screen using CDC STEADI tests: Timed Up and Go and the
        30-Second Chair Stand. Your phone does the measuring. No video leaves the phone.
      </p>
      <p className="muted">Una evaluación en casa del riesgo de caídas, en inglés o español.</p>
      <div className="row">
        <Link className="btn" href="/start">Start a screening · Empezar</Link>
      </div>
      <p className="small">
        <Link href="/pose" className="muted">Developer: camera check</Link>
      </p>
      <p className="disclaimer">
        Home screening aid, not a diagnosis; share results with your doctor.
      </p>
    </main>
  );
}
