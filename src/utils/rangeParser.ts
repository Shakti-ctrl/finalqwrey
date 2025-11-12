export interface RangeDescriptor {
  id: string;
  raw: string;
  normalized: {
    start: number;
    end: number;
  };
}

export interface ParseResult {
  success: boolean;
  ranges: RangeDescriptor[];
  errors: string[];
}

export function parseRangeInput(input: string): ParseResult {
  const errors: string[] = [];
  const ranges: RangeDescriptor[] = [];
  
  if (!input || input.trim() === '') {
    return { success: false, ranges: [], errors: ['Input cannot be empty'] };
  }

  const parts = input.split(',').map(p => p.trim()).filter(p => p);
  
  for (const part of parts) {
    const hyphenMatch = part.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
    const singleMatch = part.match(/^(\d+)$/);
    
    if (hyphenMatch) {
      const start = parseInt(hyphenMatch[1], 10);
      const end = parseInt(hyphenMatch[2], 10);
      
      if (start > end) {
        errors.push(`Invalid range "${part}": start (${start}) is greater than end (${end})`);
        continue;
      }
      
      ranges.push({
        id: `range_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        raw: part,
        normalized: { start, end }
      });
    } else if (singleMatch) {
      const num = parseInt(singleMatch[1], 10);
      ranges.push({
        id: `range_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        raw: part,
        normalized: { start: num, end: num }
      });
    } else {
      errors.push(`Invalid range format: "${part}". Use formats like "5-10" or "5–10" or "5"`);
    }
  }
  
  return {
    success: errors.length === 0,
    ranges,
    errors
  };
}

export function expandRangesToPages(ranges: RangeDescriptor[]): number[] {
  const pageNumbers = new Set<number>();
  
  for (const range of ranges) {
    for (let i = range.normalized.start; i <= range.normalized.end; i++) {
      pageNumbers.add(i);
    }
  }
  
  return Array.from(pageNumbers).sort((a, b) => a - b);
}

export function generateSequentialTags(count: number): string[] {
  const tags: string[] = [];
  const numberEmojis = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
  
  for (let i = 1; i <= count; i++) {
    const digits = i.toString().split('');
    const emojiTag = digits.map(d => numberEmojis[parseInt(d, 10)]).join('');
    tags.push(emojiTag);
  }
  
  return tags;
}

export function groupRangesByTag(ranges: RangeDescriptor[]): { [tag: string]: number[] } {
  const grouped: { [tag: string]: number[] } = {};
  const tags = generateSequentialTags(ranges.length);
  
  ranges.forEach((range, index) => {
    const tag = tags[index];
    const pageNumbers = [];
    
    for (let i = range.normalized.start; i <= range.normalized.end; i++) {
      pageNumbers.push(i);
    }
    
    grouped[tag] = pageNumbers;
  });
  
  return grouped;
}
