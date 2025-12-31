# Smart Name Mapping System

## Overview

The Smart Name Mapping System automatically learns and suggests party name corrections. When you edit a party name from "vamshi" to "krishna", the system remembers this mapping and suggests it for future transactions.

## How It Works

### 1. Learning Mechanism

**When you edit a party name:**
- Go to Transactions page
- Hover over a party name to see the edit icon
- Click the edit icon and change the name
- The system automatically learns: `"vamshi" → "krishna"`

**Confidence System:**
- Each time you apply a suggestion, confidence increases (1-10)
- Higher confidence = more reliable mapping

### 2. Suggestions

**In Transactions Table:**
- If a mapping exists, you'll see a blue badge: `→ krishna`
- Click the badge to instantly apply the correction
- The system learns from this action too

**During CSV Upload:**
- When previewing transactions, suggestions appear for known mappings
- Click the suggestion badge to apply before saving
- All saved transactions automatically use learned mappings

### 3. Management

**Party Mappings Page:**
- View all learned mappings
- Edit mappings manually
- Delete incorrect mappings
- See confidence scores

## Features

✅ **Automatic Learning** - No manual setup required  
✅ **Smart Suggestions** - Badges appear when mappings exist  
✅ **One-Click Apply** - Instant correction with a single click  
✅ **Confidence Tracking** - System tracks how reliable each mapping is  
✅ **CSV Integration** - Works seamlessly during file uploads  
✅ **Management Interface** - Full control over all mappings  

## Usage Examples

### Example 1: Learning from Edit

1. Transaction shows: "vamshi"
2. Click edit icon → Change to "krishna"
3. System learns: `"vamshi" → "krishna"` (confidence: 1)

### Example 2: Applying Suggestion

1. New transaction shows: "vamshi"
2. Blue badge appears: `→ krishna`
3. Click badge → Name changes to "krishna"
4. Confidence increases to 2

### Example 3: CSV Upload

1. Upload bank statement
2. Preview shows: "vamshi" with suggestion `→ krishna`
3. Click suggestion → Applies to all matching transactions
4. Save → All transactions use corrected names

## Technical Details

### Storage
- Mappings stored in localStorage
- Key: `party_name_mappings`
- Format: Array of `PartyNameMapping` objects

### Data Structure
```typescript
interface PartyNameMapping {
  id: string;
  originalName: string;      // "vamshi"
  correctedName: string;      // "krishna"
  confidence: number;         // 1-10
  lastUsed: string;          // ISO date
  createdAt: string;          // ISO date
}
```

### API Methods

- `PartyMappingService.learnMapping(original, corrected)` - Learn new mapping
- `PartyMappingService.getSuggestedName(name)` - Get suggestion
- `PartyMappingService.applyMapping(name)` - Apply mapping
- `PartyMappingService.getMappings()` - Get all mappings
- `PartyMappingService.deleteMapping(id)` - Delete mapping

## Best Practices

1. **Edit Early** - Edit party names as soon as you notice them
2. **Use Suggestions** - Click suggestion badges to increase confidence
3. **Review Mappings** - Periodically check Party Mappings page
4. **Delete Incorrect** - Remove mappings that are no longer valid

## Benefits

- **Time Saving** - No need to manually correct names repeatedly
- **Consistency** - Ensures party names are standardized
- **Accuracy** - Reduces data entry errors
- **Self-Improving** - Gets better with each use

---

**Note:** The system is case-insensitive and handles name variations automatically.

