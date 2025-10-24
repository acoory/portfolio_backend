import { Injectable } from '@nestjs/common';
import slugify from 'slugify';
import * as he from 'he';

@Injectable()
export class TranslationService {
  // Custom translation API endpoint
  private readonly TRANSLATE_API_URL = 'http://honydev.fr:11434/api/generate';

  // Max characters per chunk (very small to account for tokenization overhead)
  // The API counts tokens, not characters, so we need to be very conservative
  private readonly MAX_CHUNK_SIZE = 100;
  // Delay between translation requests to avoid rate limiting (in ms)
  private readonly DELAY_BETWEEN_REQUESTS = 200;
  // Maximum number of retries for failed chunks
  private readonly MAX_RETRIES = 3;
  // Delay before retrying a failed chunk (in ms)
  private readonly RETRY_DELAY = 1000;

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Count words in a text
   */
  private countWords(text: string): number {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  /**
   * Check if all HTML tags are properly closed in a text chunk
   */
  private hasUnclosedTags(text: string): boolean {
    const stack: string[] = [];
    // Match opening and closing tags
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
    let match;

    while ((match = tagRegex.exec(text)) !== null) {
      const fullTag = match[0];
      const tagName = match[1];

      // Self-closing tags (like <br />, <img />, etc.)
      if (fullTag.endsWith('/>') || ['br', 'img', 'hr', 'input', 'meta', 'link'].includes(tagName.toLowerCase())) {
        continue;
      }

      // Closing tag
      if (fullTag.startsWith('</')) {
        if (stack.length === 0 || stack[stack.length - 1] !== tagName) {
          return true; // Mismatched closing tag
        }
        stack.pop();
      }
      // Opening tag
      else {
        stack.push(tagName);
      }
    }

    // If stack is not empty, there are unclosed tags
    return stack.length > 0;
  }

  /**
   * Check if position is inside an HTML tag
   */
  private isInsideTag(text: string, position: number): boolean {
    // Look backwards to find the last '<' or '>'
    let lastOpen = text.lastIndexOf('<', position);
    let lastClose = text.lastIndexOf('>', position);

    // If the last '<' is more recent than the last '>', we're inside a tag
    return lastOpen > lastClose;
  }

  /**
   * Find the next safe cut position (not inside a tag, not inside an attribute)
   */
  private findSafeCutPosition(text: string, idealPosition: number): number {
    let pos = idealPosition;

    // If we're inside a tag, find the closing '>'
    if (this.isInsideTag(text, pos)) {
      const nextClose = text.indexOf('>', pos);
      if (nextClose !== -1) {
        pos = nextClose + 1; // Cut after the '>'
      }
    }

    return pos;
  }

  /**
   * Split text into chunks of minimum 500 chars while respecting HTML tag integrity
   * More robust version that handles incomplete tags and attributes
   */
  private splitIntoHTMLSafeChunks(text: string, minChunkSize: number = 500): string[] {
    const chunks: string[] = [];
    let currentPos = 0;

    while (currentPos < text.length) {
      // Calculate the initial end position for this chunk
      let endPos = Math.min(currentPos + minChunkSize, text.length);

      // If we're at the end of the text, take the rest
      if (endPos === text.length) {
        chunks.push(text.substring(currentPos));
        break;
      }

      // Make sure we don't cut inside an HTML tag or attribute
      endPos = this.findSafeCutPosition(text, endPos);

      // Get candidate chunk
      let candidate = text.substring(currentPos, endPos);

      // Keep extending until all HTML tags are properly closed
      let attempts = 0;
      const maxAttempts = 100; // Prevent infinite loop

      while (this.hasUnclosedTags(candidate) && endPos < text.length && attempts < maxAttempts) {
        attempts++;

        // Find the next closing tag in the remaining text
        const remainingText = text.substring(endPos);
        const nextClosingTag = remainingText.match(/<\/[^>]+>/);

        if (nextClosingTag && nextClosingTag.index !== undefined) {
          // Extend to include the closing tag
          endPos += nextClosingTag.index + nextClosingTag[0].length;

          // Make sure we're not cutting inside another tag
          endPos = this.findSafeCutPosition(text, endPos);

          candidate = text.substring(currentPos, endPos);
        } else {
          // No more closing tags found, take the rest
          endPos = text.length;
          candidate = text.substring(currentPos);
          break;
        }
      }

      // Safety check: if candidate is empty or something went wrong, take at least minChunkSize
      if (candidate.trim().length === 0 || attempts >= maxAttempts) {
        endPos = Math.min(currentPos + minChunkSize, text.length);
        candidate = text.substring(currentPos, endPos);
      }

      chunks.push(candidate);
      currentPos = endPos;
    }

    return chunks;
  }

  /**
   * Split text into chunks based on character count (max 500 chars per chunk)
   * Preserves paragraphs and sentences structure
   */
  private splitTextIntoChunks(text: string): string[] {
    console.log(`📊 Total characters: ${text.length}`);

    if (text.length <= this.MAX_CHUNK_SIZE) {
      console.log(`✓ Text fits in single chunk (${text.length} chars)`);
      return [text];
    }

    const chunks: string[] = [];
    // Split by paragraphs first
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';

    console.log(
      `📝 Splitting into chunks of max ${this.MAX_CHUNK_SIZE} characters...`,
    );

    for (const paragraph of paragraphs) {
      // If a single paragraph exceeds the limit, split by sentences
      if (paragraph.length > this.MAX_CHUNK_SIZE) {
        // Save current chunk if exists
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          console.log(
            `  ✓ Chunk ${chunks.length}: ${currentChunk.trim().length} chars`,
          );
          currentChunk = '';
        }

        // Split large paragraph by sentences
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length + 1 > this.MAX_CHUNK_SIZE) {
            if (currentChunk) {
              chunks.push(currentChunk.trim());
              console.log(
                `  ✓ Chunk ${chunks.length}: ${currentChunk.trim().length} chars`,
              );
            }
            currentChunk = sentence + ' ';
          } else {
            currentChunk += sentence + ' ';
          }
        }
      } else {
        // Check if adding this paragraph exceeds the limit
        if (currentChunk.length + paragraph.length + 2 > this.MAX_CHUNK_SIZE) {
          chunks.push(currentChunk.trim());
          console.log(
            `  ✓ Chunk ${chunks.length}: ${currentChunk.trim().length} chars`,
          );
          currentChunk = paragraph + '\n\n';
        } else {
          currentChunk += paragraph + '\n\n';
        }
      }
    }

    // Add the last chunk
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      console.log(
        `  ✓ Chunk ${chunks.length}: ${currentChunk.trim().length} chars`,
      );
    }

    return chunks;
  }

  /**
   * Translate text from French to English
   * Splits text into chunks of 1000 characters maximum
   */
  async translateToEnglish(text: string): Promise<string> {
    if (!text || text.trim() === '') {
      console.log('⚠️  Empty text, skipping translation');
      return '';
    }

    const startTime = Date.now();
    console.log('\n🌍 ========== TRANSLATION START ==========');
    console.log(`📝 Text length: ${text.length} characters`);

    // Smart HTML-aware chunking
    const minChunkSize = 500;
    const chunks = this.splitIntoHTMLSafeChunks(text, minChunkSize);

    console.log(
      `📦 Split into ${chunks.length} chunk(s) (min ${minChunkSize} chars, HTML-safe)\n`,
    );

    // Log chunk sizes for debugging
    chunks.forEach((chunk, index) => {
      const hasUnclosed = this.hasUnclosedTags(chunk);
      const startsValid = chunk.trim().length === 0 || !chunk.trim().startsWith('=');
      const status = hasUnclosed ? '⚠️ UNCLOSED' : (startsValid ? '✓ OK' : '⚠️ BAD START');
      console.log(
        `   Chunk ${index + 1}: ${chunk.length} chars ${status}`,
      );

      // Show first 50 chars for debugging
      if (!startsValid || hasUnclosed) {
        console.log(`      Preview: ${chunk.substring(0, 80)}...`);
      }
    });
    console.log('');

    const translatedChunks: string[] = [];
    let successCount = 0;
    let failCount = 0;
    let totalRequestTime = 0;

    // Translate each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      console.log(`🔄 Chunk ${i + 1}/${chunks.length} - ${chunk.length} chars`);
      console.log(`   📤 Sending request to ${this.TRANSLATE_API_URL}`);

      const requestStart = Date.now();

      console.log(`   📝 Chunk preview: ${chunk.substring(0, 50)}...`);

      // Decode HTML entities before translation
      // const decodedChunk = he.decode(chunk);
      // console.log(`   🔓 Decoded preview: ${decodedChunk.substring(0, 50)}...`);

      try {
        const response = await fetch(this.TRANSLATE_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama3.2:3b',
            prompt: `You are a professional translator. Translate from French to English. Preserve all HTML tags and attributes exactly. Only translate the text content between tags. Be accurate and natural. Return ONLY the translated HTML without any introduction, explanation, or additional text. If the input contains HTML tags, keep all tags intact. If the input contains no HTML tags, return only the translated plain text without adding any tags. :\n\n${chunk}`,
            stream: false,
          }),
        });

        const requestTime = Date.now() - requestStart;
        totalRequestTime += requestTime;

        console.log(
          `   📥 Response status: ${response.status} (${requestTime}ms)`,
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log('data:', data);

        const translated =
          data.translated_text ||
          data.translatedText ||
          data.translation ||
          data.text ||
          data.response;

        if (!translated) {
          throw new Error('No translation in response');
        }

        console.log(
          `   📝 Translated preview: ${translated.substring(0, 50)}...`,
        );

        // Don't re-encode: keep HTML tags as-is for React's dangerouslySetInnerHTML
        translatedChunks.push(translated);
        successCount++;
        console.log(`   ✅ Success - ${translated.length} chars translated\n`);

        // Wait between chunks
        if (i < chunks.length - 1) {
          console.log(`   ⏱️  Waiting ${this.DELAY_BETWEEN_REQUESTS}ms...\n`);
          await this.sleep(this.DELAY_BETWEEN_REQUESTS);
        }
      } catch (error) {
        failCount++;
        const requestTime = Date.now() - requestStart;
        totalRequestTime += requestTime;

        console.error(`   ❌ Error after ${requestTime}ms: ${error.message}`);
        console.log(`   🔙 Using original text for this chunk\n`);
        translatedChunks.push(chunk);
      }
    }

    const result = translatedChunks.join('');
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const avgRequestTime =
      chunks.length > 0 ? Math.round(totalRequestTime / chunks.length) : 0;

    console.log(`✅ ========== TRANSLATION COMPLETED ==========`);
    console.log(`   📊 Statistics:`);
    console.log(`      • Total requests: ${chunks.length}`);
    console.log(`      • Successful: ${successCount} ✅`);
    console.log(`      • Failed: ${failCount} ❌`);
    console.log(
      `      • Success rate: ${((successCount / chunks.length) * 100).toFixed(1)}%`,
    );
    console.log(`   ⏱️  Performance:`);
    console.log(`      • Total time: ${totalTime}s`);
    console.log(`      • Avg request time: ${avgRequestTime}ms`);
    console.log(
      `      • Requests/sec: ${(chunks.length / parseFloat(totalTime)).toFixed(2)}`,
    );
    console.log(`   📝 Text:`);
    console.log(`      • Original: ${text.length} chars`);
    console.log(`      • Translated: ${result.length} chars`);
    console.log(`      • Difference: ${result.length - text.length} chars`);
    console.log(`=============================================\n`);

    return result;
  }

  /**
   * Translate multiple texts at once
   */
  async translateMultiple(texts: string[]): Promise<string[]> {
    const translations = await Promise.all(
      texts.map((text) => this.translateToEnglish(text)),
    );
    return translations;
  }

  /**
   * Generate English slug from translated title
   */
  generateEnglishSlug(translatedTitle: string, baseSlug?: string): string {
    if (baseSlug) {
      return slugify(baseSlug, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
    }

    return slugify(translatedTitle, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g,
    });
  }
}
