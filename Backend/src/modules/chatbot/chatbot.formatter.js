/**
 * Chatbot Formatter - Centralized utility for consistent response presentation
 * Ensures professional tone, proper spacing, and structured content
 */
class ChatbotFormatter {
  constructor() {
    this.bullet = '•';
    this.separator = '────────────────';
  }

  /**
   * Remove markdown syntax from text
   * @param {string} text 
   * @returns {string}
   */
  stripMarkdown(text) {
    if (!text || typeof text !== 'string') return text || '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold **
      .replace(/\*(.*?)\*/g, '$1')     // Remove italic *
      .replace(/###\s+/g, '')          // Remove ###
      .replace(/##\s+/g, '')           // Remove ##
      .replace(/#\s+/g, '')            // Remove #
      .replace(/^-{3,}$/gm, this.separator) // Replace markdown separators
      .replace(/[`~]/g, '')            // Remove code ticks or strikethrough
      .replace(/\n{3,}/g, '\n\n')      // Normalize multiple newlines
      .trim();
  }

  /**
   * Format a dynamic heading
   * @param {string} title 
   * @returns {string}
   */
  formatHeading(title) {
    if (!title) return '';
    return `\n${this.stripMarkdown(title)}\n\n`;
  }

  /**
   * Format a section with a heading and content
   * @param {string} title 
   * @param {string} content 
   * @returns {string}
   */
  formatSection(title, content) {
    if (!content) return '';
    const heading = this.formatHeading(title);
    return `${heading}${this.stripMarkdown(content)}\n`;
  }

  /**
   * Format guidance/instructions
   * @param {Object} params
   * @returns {string}
   */
  formatGuidance({ title, intro, steps, notes, closing }) {
    let output = this.formatHeading(title);
    
    if (intro) output += `${this.stripMarkdown(intro)}\n\n`;
    
    if (Array.isArray(steps) && steps.length > 0) {
      output += steps.map((step, index) => `${index + 1}. ${this.stripMarkdown(step)}`).join('\n') + '\n';
    } else if (typeof steps === 'string' && steps) {
      output += this.stripMarkdown(steps) + '\n';
    }

    if (Array.isArray(notes) && notes.length > 0) {
      output += `\nAdditional Notes:\n` + notes.map(note => `${this.bullet} ${this.stripMarkdown(note)}`).join('\n') + '\n';
    } else if (typeof notes === 'string' && notes) {
      output += `\nAdditional Notes:\n${this.stripMarkdown(notes)}\n`;
    }

    if (closing) output += `\n${this.stripMarkdown(closing)}`;

    return output.trim();
  }

  /**
   * Format a list of items (tasks, checklists, etc.)
   * @param {Array} items - List of item objects
   * @param {string} title - Section title
   * @param {string} type - 'task', 'checklist', or 'delegation'
   * @returns {string}
   */
  formatList(items, title, type = 'item') {
    if (!items || items.length === 0) {
      return `You currently do not have any ${type}s.`;
    }

    let output = this.formatHeading(title);

    const listContent = items.map(item => {
      const name = this.stripMarkdown(item.name || item.question || item.delegation_name || 'Unnamed Item');
      const dueDate = item.due_date
        ? new Date(item.due_date).toLocaleDateString('en-GB')
        : 'No due date';

      // For combined task lists, prefix with the sub-type (Checklist / Delegation)
      if (type === 'task' && item.type) {
        return `${this.bullet} [${item.type}] ${name} — Due: ${dueDate}`;
      }
      return `${this.bullet} ${name} — Due: ${dueDate}`;
    }).join('\n');

    return output + listContent;
  }

  /**
   * Specific list renderers for convenience
   */
  formatTaskList(tasks, title = 'Pending Tasks') {
    return this.formatList(tasks, title, 'task');
  }

  formatChecklistList(checklists, title = 'Checklists') {
    return this.formatList(checklists, title, 'checklist');
  }

  formatDelegationList(delegations, title = 'Delegations') {
    return this.formatList(delegations, title, 'delegation');
  }

  /**
   * Format count summaries
   * @param {string} title 
   * @param {Array} counts - Array of { label, count }
   * @returns {string}
   */
  formatSummaryCount(title, counts) {
    let output = this.formatHeading(title);
    output += `You currently have:\n\n`;
    output += counts.map(item => `${this.bullet} ${item.count} ${this.stripMarkdown(item.label)}`).join('\n');
    return output;
  }

  /**
   * Combine multiple responses for multi-intent queries
   * @param {Array} responses - Array of formatted strings
   * @returns {string}
   */
  formatMixedResponse(responses) {
    return responses.filter(Boolean).join('\n\n' + this.separator + '\n');
  }

  /**
   * Format clarification options
   * @param {string} intro 
   * @param {Array} options 
   * @returns {string}
   */
  formatClarification(intro, options) {
    let output = intro ? `${this.stripMarkdown(intro)}\n\n` : "Please specify what you would like to do:\n\n";
    output += options.map(opt => `${this.bullet} ${this.stripMarkdown(opt)}`).join('\n');
    return output;
  }
}

module.exports = new ChatbotFormatter();
