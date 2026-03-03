# NotebookLM Deliverables Guide

All deliverables are generated through the Studio panel in NotebookLM. The `generate` command automates this.

## Available Types

### Video Overview
- **UI Path**: Studio > Video Overview > Generate
- **Generation Time**: 2-5 minutes
- **Output**: MP4 video file
- **Customization**: Instructions field for focus areas, style preferences
- **Limitations**: Requires sufficient source material (at least 2-3 sources recommended)

### Slide Deck
- **UI Path**: Studio > Slide Deck > Generate
- **Generation Time**: 1-3 minutes
- **Output**: PDF or Google Slides link
- **Customization**: Length (brief/detailed), presenter notes toggle, focus instructions
- **Best For**: Summarizing research into presentation format

### Infographic
- **UI Path**: Studio > Infographic > Generate
- **Generation Time**: 1-3 minutes
- **Output**: PNG image
- **Customization**: Orientation (landscape/portrait/square), detail level, focus area
- **Best For**: Visual summaries, statistics, comparisons

### Quiz
- **UI Path**: Studio > Quiz > Generate
- **Generation Time**: 30-60 seconds
- **Output**: Text (multiple choice questions with answers)
- **Customization**: Number of questions, difficulty level
- **Extraction**: Script saves as text file, parseable for integration into study tools

### Flashcards
- **UI Path**: Studio > Flashcards > Generate
- **Generation Time**: 30-60 seconds
- **Output**: Text (front/back pairs)
- **Customization**: Number of cards, difficulty focus
- **Extraction**: Script saves as text file with front/back structure

### Report (Briefing Doc)
- **UI Path**: Studio > Briefing Doc > Generate
- **Generation Time**: 1-2 minutes
- **Output**: Text (structured document with sections)
- **Customization**: Style (briefing doc, study guide, blog post), focus instructions
- **Best For**: Long-form summaries, executive briefings, study materials

### Data Table
- **UI Path**: Studio > Data Table > Generate
- **Generation Time**: 30-60 seconds
- **Output**: Structured text (tabular format)
- **Customization**: Column structure via natural language instructions
- **Best For**: Extracting structured data from unstructured sources

### Mind Map
- **UI Path**: Studio > Mind Map > Generate
- **Generation Time**: 30-60 seconds
- **Output**: Interactive visual (extracted as text hierarchy)
- **Customization**: Depth level, focus area
- **Best For**: Concept relationships, topic hierarchies, overview structures

## Command Examples

```bash
# Generate a slide deck focused on market analysis
python scripts/notebooklm_client.py generate --notebook "Market Research" --type slides --instructions "Focus on competitor analysis and market size"

# Create flashcards for study
python scripts/notebooklm_client.py generate --notebook "Biology Notes" --type flashcards

# Generate an infographic summarizing key statistics
python scripts/notebooklm_client.py generate --notebook "Annual Report" --type infographic --instructions "Highlight revenue growth and user metrics"

# Create a briefing document
python scripts/notebooklm_client.py generate --notebook "Project Alpha" --type report --instructions "Executive summary format, 2 pages max"

# Extract structured data
python scripts/notebooklm_client.py generate --notebook "Survey Results" --type table --instructions "Columns: question, response_count, percentage, sentiment"
```

## Output Directory

All generated files are saved to `./notebooklm-output/` (or `NOTEBOOKLM_OUTPUT_DIR` env var).

Files are named `{type}_{timestamp}.{ext}`:
- `slides_1709500000.pdf`
- `infographic_1709500000.png`
- `quiz_1709500000.txt`
- `report_1709500000.txt`

## Source Requirements

NotebookLM works best with:
- **Minimum**: 1 source (but results improve with 2-3+)
- **Maximum**: 50 sources per notebook
- **Supported types**: URLs, PDFs, DOCX, TXT, Google Docs, YouTube videos, copied text
- **Source processing**: Takes 10-60 seconds per source depending on size
- **Tip**: Wait for all sources to finish processing before querying or generating

## Known Limitations

1. **UI selectors may change**: NotebookLM updates its UI without notice. If commands fail, selectors in `notebooklm_client.py` may need updating.
2. **Rate limiting**: Rapid consecutive generations may trigger Google's rate limits. Space requests 30+ seconds apart.
3. **Large sources**: Very large PDFs (100+ pages) may timeout during processing. Split into smaller files.
4. **Video generation**: Slowest artifact type. May occasionally fail. Retry once before reporting error.
5. **No audio**: Audio Overview generation is excluded from this skill.
