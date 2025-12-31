# AI-Powered Party Name Extraction Setup Guide

## 🚀 Overview

The system now supports **AI-powered automatic party name extraction** from bank statement narrations! This uses AI to intelligently identify and extract party/company names from complex bank narrations.

## ✨ Features

- **Automatic Extraction**: AI extracts party names during CSV/Excel upload
- **Multiple AI Providers**: Supports OpenAI, Anthropic Claude, or custom APIs
- **Smart Learning**: AI-extracted names still train the pattern-based system
- **Fallback System**: If AI fails, falls back to pattern extraction + manual entry
- **Cost-Effective**: Uses cheaper models (GPT-3.5-turbo, Claude Haiku)

## 📋 Setup Instructions

### Option 1: OpenAI (Recommended for Beginners)

1. **Get API Key**:
   - Go to [platform.openai.com](https://platform.openai.com)
   - Sign up or log in
   - Go to **API Keys** section
   - Click **Create new secret key**
   - Copy the key (starts with `sk-...`)

2. **Configure in App**:
   - Open the app → Go to **AI Settings** (in sidebar)
   - Enable "AI-powered party name extraction"
   - Select **OpenAI** as provider
   - Paste your API key
   - Click **Save Settings**

3. **Test It**:
   - Use the test section in AI Settings
   - Enter a sample narration like:
     ```
     NEFT CR-SBIN0002776-MERCURE MEDI SURGE INNOVATIONS PRIV-SRI RAJA RAJESHWARI ORTHO-SBINN52025110406690875
     ```
   - Click **Test Extraction**
   - Should extract: `MERCURE MEDI SURGE INNOVATIONS PRIV`

### Option 2: Anthropic Claude

1. **Get API Key**:
   - Go to [console.anthropic.com](https://console.anthropic.com)
   - Sign up or log in
   - Go to **API Keys**
   - Create a new key
   - Copy the key (starts with `sk-ant-...`)

2. **Configure in App**:
   - Open **AI Settings**
   - Enable AI extraction
   - Select **Anthropic** as provider
   - Paste your API key
   - Click **Save Settings**

### Option 3: Custom API

If you have your own AI API endpoint:

1. **Configure in App**:
   - Open **AI Settings**
   - Enable AI extraction
   - Select **Custom API**
   - Enter your API endpoint URL
   - (Optional) Enter API key if required
   - Click **Save Settings**

2. **API Format**:
   Your API should accept POST requests with:
   ```json
   {
     "narration": "NEFT CR-SBIN0002776-MERCURE...",
     "task": "extract_party_name"
   }
   ```
   
   And return:
   ```json
   {
     "partyName": "MERCURE MEDI SURGE INNOVATIONS PRIV",
     "confidence": 0.9
   }
   ```

## 💰 Cost Considerations

### OpenAI Pricing (as of 2024):
- **GPT-4o-mini**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **GPT-3.5-turbo**: ~$0.50 per 1M input tokens, ~$1.50 per 1M output tokens
- **Estimated cost**: ~$0.001-0.005 per transaction (very cheap!)

### Anthropic Pricing:
- **Claude Haiku**: ~$0.25 per 1M input tokens, ~$1.25 per 1M output tokens
- **Estimated cost**: ~$0.001-0.003 per transaction

### Recommendation:
- Use **GPT-4o-mini** or **Claude Haiku** for cost-effective extraction
- For 1000 transactions/month: ~$1-5 total cost
- Much cheaper than manual entry time!

## 🎯 How It Works

### During CSV Upload:

1. **File Upload**: You upload CSV/Excel file
2. **Parsing**: System parses transactions (party names blank by default)
3. **AI Extraction** (if enabled):
   - System sends narrations to AI API
   - AI extracts party names automatically
   - Party names are filled in automatically
4. **Preview**: You see transactions with AI-extracted party names
5. **Save**: Transactions saved with party names
6. **Learning**: AI-extracted names train the pattern-based system

### Example Flow:

```
Narration: "NEFT CR-SBIN0002776-MERCURE MEDI SURGE INNOVATIONS PRIV-SRI RAJA RAJESHWARI ORTHO-SBINN52025110406690875"
         ↓
AI Extraction: "MERCURE MEDI SURGE INNOVATIONS PRIV"
         ↓
Transaction saved with party name
         ↓
System learns pattern for future similar narrations
```

## 🔒 Security & Privacy

- **API Keys**: Stored locally in browser (localStorage)
- **No Server**: API keys never sent to our servers
- **Direct API Calls**: App calls AI APIs directly from your browser
- **Privacy**: Narrations sent to AI provider (check their privacy policy)

## ⚙️ Advanced Configuration

### Batch Processing:
- System processes narrations in batches of 5
- 1-second delay between batches (to avoid rate limits)
- For large files (100+ transactions), extraction may take 20-30 seconds

### Rate Limits:
- OpenAI: 3,500 requests/minute (free tier: 3 requests/minute)
- Anthropic: Varies by plan
- If you hit limits, system will show errors

### Error Handling:
- If AI extraction fails, system continues without AI
- Falls back to pattern-based extraction
- You can still manually enter party names

## 🧪 Testing

1. **Test in AI Settings**:
   - Enter sample narration
   - Click "Test Extraction"
   - Verify extracted party name

2. **Test with Real CSV**:
   - Upload a small CSV file (5-10 transactions)
   - Check if party names are extracted correctly
   - Review and adjust if needed

## 📊 Comparison: AI vs Pattern-Based

| Feature | AI Extraction | Pattern-Based |
|---------|--------------|---------------|
| **Accuracy** | High (90%+) | Medium (60-70%) |
| **Setup** | Requires API key | No setup needed |
| **Cost** | ~$0.001-0.005/transaction | Free |
| **Speed** | Slower (API calls) | Instant |
| **Learning** | Yes (trains patterns) | Yes (pattern matching) |
| **Best For** | Complex narrations | Simple patterns |

## 🎓 Best Practices

1. **Start Small**: Test with 10-20 transactions first
2. **Review Results**: Always review AI-extracted names before saving
3. **Combine Approaches**: Use AI for extraction + pattern learning for future
4. **Monitor Costs**: Check your API usage dashboard
5. **Keep Learning**: System learns from your corrections

## 🐛 Troubleshooting

### "AI extraction error"
- Check API key is correct
- Verify you have API credits/quota
- Check internet connection
- Try test extraction first

### "No party name extracted"
- Narration might be too complex
- Try manual entry (system will learn)
- Check AI provider status

### "Rate limit exceeded"
- Wait a few minutes
- Process smaller batches
- Upgrade API plan if needed

## 📝 Notes

- AI extraction is **optional** - system works without it
- AI-extracted names are **suggestions** - you can edit them
- System **learns from AI extractions** to improve pattern matching
- You can **disable AI** anytime and use pattern-based extraction only

---

**Ready to use AI?** Go to **AI Settings** in the sidebar and configure your API key!

