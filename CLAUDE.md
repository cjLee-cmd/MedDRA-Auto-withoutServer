# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a **MedDRA (Medical Dictionary for Regulatory Activities) Version 28.1 Korean** data distribution repository. MedDRA is a standardized international medical terminology used to classify adverse event information associated with the use of biopharmaceuticals and medical products.

**Key Characteristics:**
- **Language**: Korean (UTF-8 encoding)
- **Version**: 28.1 (September 2025)
- **Purpose**: Medical terminology database for adverse event reporting and classification
- **Data Format**: ASCII delimited files (.asc) with $ as field separator

## Directory Structure

```
.
├── ascii-281/           # Primary MedDRA terminology data files
├── seq-281/            # Sequential files (change tracking)
├── *.pdf               # Documentation files (Korean)
├── version_report_28_1_Korean.xlsx
└── !!readme_28_1_Korean.txt
```

## Data Architecture

### Hierarchical Structure

MedDRA uses a 5-level hierarchical classification system from most general to most specific:

```
SOC (System Organ Class)
  └── HLGT (High Level Group Term)
      └── HLT (High Level Term)
          └── PT (Preferred Term)
              └── LLT (Lowest Level Term)
```

### Core Data Files (ascii-281/)

**Terminology Files:**
- `soc.asc` - System Organ Class (highest level, ~27 categories)
- `hlgt.asc` - High Level Group Terms
- `hlt.asc` - High Level Terms
- `pt.asc` - Preferred Terms (primary classification level)
- `llt.asc` - Lowest Level Terms (most specific, ~80,000+ terms)

**Relationship Files:**
- `soc_hlgt.asc` - SOC to HLGT mappings
- `hlgt_hlt.asc` - HLGT to HLT mappings
- `hlt_pt.asc` - HLT to PT mappings
- `mdhier.asc` - Complete hierarchical relationships (PT to SOC path)

**Special Files:**
- `smq_list.asc` - Standardised MedDRA Queries (SMQ) definitions
- `smq_content.asc` - SMQ to PT mappings with scope (narrow/broad)
- `intl_ord.asc` - International ordering preferences
- `meddra_history_korean.asc` - Historical change tracking
- `meddra_release.asc` - Version information

### Sequential Files (seq-281/)

Track changes from previous release. Fields include:
- Date of change
- Change type (M=Modified, etc.)
- Version information
- Modified term data

Most seq files in 28.1 are empty (no changes), but some contain updates:
- `llt.seq` - ~1,000 LLT changes
- `pt.seq` - ~300 PT changes
- `hlt_pt.seq` - Relationship changes
- `mdhier.seq` - Hierarchy changes

## File Format Specifications

### Standard ASC Format

All .asc files use:
- **Delimiter**: `$` (dollar sign)
- **Encoding**: UTF-8 (for Korean)
- **Line Ending**: Unix-style (LF)
- **No Header Row**: Data starts immediately

### Field Structures by File Type

**LLT (llt.asc):**
```
llt_code$llt_name$pt_code$[empty fields]$llt_currency$
Example: 10000001$"환기" 폐염증$10081988$$$$$$$N$$
```

**PT (pt.asc):**
```
pt_code$pt_name$[classification fields]$pt_soc_code$[flags]
```

**Hierarchy (mdhier.asc):**
```
pt_code$hlt_code$hlgt_code$soc_code$pt_name$hlt_name$hlgt_name$soc_name$soc_abbrev$$primary_soc_code$[flag]
Example: 10002043$10002042$10002086$10005329$폴산염 결핍성 빈혈$각종 결핍성 빈혈$비용혈성 빈혈 및 골수 억제$혈액 및 림프계 장애$Blood$$10005329$Y$
```

**SMQ List (smq_list.asc):**
```
smq_code$smq_name$smq_level$smq_description$smq_source$[note]$version$status$algorithm_flag$
```

**SMQ Content (smq_content.asc):**
```
smq_code$term_code$term_level$term_scope$term_category$term_weight$term_status$term_addition_version$term_last_modified_version$
- term_level: 4=PT, 5=LLT
- term_scope: 1=broad, 2=narrow
- term_category: A=active
```

**Sequential Files (*.seq):**
```
date$change_type$version$[same fields as corresponding .asc file]
Example: 1/9/2025$M$13$10028715$발작 수면 및 허탈 발작$10028713$$$$$$$Y$$
```

## Working with MedDRA Data

### Common Operations

**1. Term Lookup:**
Search by code or name in appropriate file (llt.asc for specific terms, pt.asc for preferred terms)

**2. Hierarchy Navigation:**
- Start with PT code
- Use mdhier.asc to find complete classification path to SOC
- Or traverse relationships via hlt_pt.asc → hlgt_hlt.asc → soc_hlgt.asc

**3. SMQ Analysis:**
- Find relevant SMQs in smq_list.asc
- Get associated terms from smq_content.asc
- Filter by term_scope (1=broad, 2=narrow) based on analysis needs

**4. Change Tracking:**
Compare seq-281/*.seq files against ascii-281/*.asc to identify modifications in version 28.1

### Data Validation Considerations

- **Currency**: Check llt_currency field (Y=current, N=outdated)
- **Primary SOC**: Each PT has one primary SOC for classification
- **Code Format**: All codes are numeric (8 digits)
- **Empty Fields**: Multiple consecutive $ indicate empty fields (important for parsing)

## Important Notes

- **Encoding**: This is a UTF-8 Korean distribution; English terms use extended ASCII
- **Trademark**: MedDRA® is a registered trademark of ICH
- **Access**: Data access requires MedDRA subscription and credentials
- **Browsers**: MSSO provides desktop, web, and mobile browsers for data exploration
- **Updates**: Version 28.1 released September 2025; check seq files for changes from 28.0

## Documentation Files

- `dist_file_format_28_1_Korean.pdf` - Comprehensive file format specification
- `intguide_28_1_Korean.pdf` - MedDRA introduction guide
- `SMQ_intguide_28_1_Korean.pdf` - SMQ introduction guide
- `whatsnew_28_1_Korean.pdf` - Version 28.1 changes summary
- `version_report_28_1_Korean.xlsx` - Detailed version report
- `!!readme_28_1_Korean.txt` - Distribution file list and overview

## Support

For distribution issues: mssohelp@meddra.org (MedDRA MSSO Helpdesk)
