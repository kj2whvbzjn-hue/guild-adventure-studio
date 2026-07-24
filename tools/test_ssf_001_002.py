#!/usr/bin/env python3
from pathlib import Path
import re,sys
root=Path(__file__).resolve().parents[1]
text=(root/'index.html').read_text(encoding='utf-8')
required_ids=['storyDesignFields','storyDesignGoal','storyDesignCharacters','storyDesignRequired','storyDesignProhibited','storyDesignTimeline','storyDesignDirection','storyDesignOutputFormat','storyDesignLength','storyPromptOutput','storyPromptMeta']
required_functions=['normalizeStoryDesign','buildStoryPrompt','copyStoryPrompt','storyPromptLine']
errors=[]
for x in required_ids:
    if f'id="{x}"' not in text: errors.append('MISSING_ID '+x)
for x in required_functions:
    if not re.search(rf'function\s+{re.escape(x)}\s*\(',text): errors.append('MISSING_FUNCTION '+x)
for token in ['SOURCE_SNAPSHOT','source_design_version','target_id','prohibited_events','required_events']:
    if token not in text: errors.append('MISSING_PROMPT_CONTRACT '+token)
if "storyDesignFields.classList.toggle('hidden',!['chapter','section'].includes(type))" not in text:
    errors.append('DESIGN_SCOPE_NOT_RESTRICTED')
if 'automatic scenario generation' not in (root/'SGF_PHASE_PLAN.md').read_text(encoding='utf-8'):
    errors.append('FROZEN_BOUNDARY_MISSING')
print('SSF_UI_FIELDS='+str(len(required_ids)))
print('SSF_FUNCTIONS='+str(len(required_functions)))
for e in errors: print('ERROR',e)
print('SSF_001_002_RESULT='+('PASS' if not errors else 'FAIL'))
sys.exit(1 if errors else 0)
