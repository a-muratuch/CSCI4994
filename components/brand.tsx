import Image from "next/image";

/** Shared project identity; artwork attribution is included in the landing-page footer. */
export function Brand() {
  return (
    <span className="inline-flex shrink-0 items-center gap-2">
      <Image
        src="/brand/ole-miss-script.png"
        alt=""
        width={44}
        height={44}
        className="size-11 shrink-0 object-contain"
      />
      <span className="whitespace-nowrap text-lg font-semibold tracking-tight">
        Rebel Move
      </span>
    </span>
  );
}
