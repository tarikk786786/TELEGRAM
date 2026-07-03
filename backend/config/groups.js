/**
 * Configured Telegram groups for the Hub.
 *
 * Each entry describes one group the bot is a member of.
 *
 * Fields:
 *   id          – The Telegram chat_id (string). For public groups this is
 *                 usually the @username prefixed with "@". For private /
 *                 super-groups it is a numeric ID (often negative, e.g.
 *                 "-1001234567890").
 *   name        – Human-readable display name.
 *   description – Short description shown in the UI.
 *   type        – "public" or "private".
 *   invite_link – A t.me invite link for the group, or null if not applicable.
 */

const groups = [
  {
    id: "@example_public_group",
    name: "Tech News",
    description: "Latest technology news, updates, and discussions.",
    type: "public",
    invite_link: "https://t.me/example_public_group",
  },
  {
    id: "@example_public_group_2",
    name: "Crypto Signals",
    description: "Cryptocurrency market analysis and trading signals.",
    type: "public",
    invite_link: "https://t.me/example_public_group_2",
  },
  {
    id: "-1001234567890",
    name: "VIP Members Lounge",
    description: "Exclusive private group for premium members.",
    type: "private",
    invite_link: null,
  },
];

module.exports = groups;
