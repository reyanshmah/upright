import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>Upright</h1>
      <p>
        A 10-minute home fall-risk screen using CDC STEADI tests: Timed Up and Go and the
        30-Second Chair Stand. Your phone does the measuring. No video leaves the phone.
      </p>
      <div className="row">
        <Link className="btn" href="/pose">Camera check (skeleton overlay)</Link>
      </div>
      <p className="disclaimer">
        Home screening aid, not a diagnosis; share results with your doctor.
      </p>
    </main>
  );
}
