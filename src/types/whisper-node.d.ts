declare module "whisper-node" {
  interface WhisperSegment {
    start: string;
    end: string;
    speech: string;
  }

  function whisper(
    filePath: string,
    options: Record<string, unknown>
  ): Promise<WhisperSegment[]>;

  export default whisper;
  export { whisper };
}
