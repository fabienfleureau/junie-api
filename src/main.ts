import { defineCommand, runMain } from "citty"
import { start } from "./start.js"
import { runAuthFlow } from "./auth.js"
import { printBalance } from "./balance.js"

const authCommand = defineCommand({
  meta: {
    name: "auth",
    description: "Run JetBrains authentication flow without starting the server",
  },
  args: {
    verbose: {
      type: "boolean",
      description: "Enable verbose logging",
      default: false,
      alias: "v",
    },
    "show-token": {
      type: "boolean",
      description: "Show tokens during auth",
      default: false,
    },
  },
  async run({ args }) {
    await runAuthFlow({ showToken: args["show-token"] })
  },
})

const startCommand = defineCommand({
  meta: {
    name: "start",
    description: "Start the Junie API proxy server",
  },
  args: {
    port: {
      type: "string",
      description: "Port to listen on",
      default: "4141",
      alias: "p",
    },
    verbose: {
      type: "boolean",
      description: "Enable verbose logging",
      default: false,
      alias: "v",
    },
    "auth-token": {
      type: "string",
      description: "Provide auth token directly (API key from junie.jetbrains.com/cli or OAuth JWT)",
      alias: "a",
    },
    "show-token": {
      type: "boolean",
      description: "Show tokens on fetch and refresh",
      default: false,
    },
    "rate-limit": {
      type: "string",
      description: "Rate limit in seconds between requests",
      alias: "r",
    },
    wait: {
      type: "boolean",
      description: "Wait instead of error when rate limit is hit",
      default: false,
      alias: "w",
    },
    "claude-code": {
      type: "boolean",
      description: "Generate a command to launch Claude Code with Junie API config",
      default: false,
      alias: "c",
    },
  },
  async run({ args }) {
    await start({
      port: parseInt(args.port, 10),
      verbose: args.verbose,
      authToken: args["auth-token"],
      showToken: args["show-token"],
      rateLimit: args["rate-limit"] ? parseInt(args["rate-limit"], 10) : undefined,
      wait: args.wait,
      claudeCode: args["claude-code"],
    })
  },
})

const balanceCommand = defineCommand({
  meta: {
    name: "balance",
    description: "Print current account balance",
  },
  args: {
    "auth-token": {
      type: "string",
      description: "Provide auth token directly (API key from junie.jetbrains.com/cli or OAuth JWT)",
      alias: "a",
    },
    "show-token": {
      type: "boolean",
      description: "Show tokens during auth",
      default: false,
    },
    verbose: {
      type: "boolean",
      description: "Show HTTP request/response details",
      default: false,
      alias: "v",
    },
  },
  async run({ args }) {
    await printBalance({ authToken: args["auth-token"], showToken: args["show-token"], verbose: args.verbose })
  },
})

const main = defineCommand({
  meta: {
    name: "junie-api",
    version: "0.2.0",
    description: "Turn JetBrains Junie AI into an OpenAI/Anthropic API compatible server",
  },
  subCommands: {
    start: startCommand,
    auth: authCommand,
    balance: balanceCommand,
  },
  async setup() {
    // If no subcommand given, default to starting the server
    const subcommand = process.argv[2]
    if (!subcommand || subcommand.startsWith("-")) {
      await start({ port: 4141, verbose: false, showToken: false, rateLimit: undefined, wait: false, claudeCode: false })
      process.exit(0)
    }
  },
})

runMain(main)
