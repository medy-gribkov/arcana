const BASH_COMPLETIONS = `# arcana bash completion
_arcana_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local commands="list install info search providers create validate update uninstall init doctor clean compact stats config audit scan optimize verify lock profile benchmark diff outdated team export import completions"

  if [ "\${COMP_CWORD}" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
  fi
}
complete -F _arcana_completions arcana
`;
const ZSH_COMPLETIONS = `#compdef arcana
_arcana() {
  local -a commands
  commands=(
    'list:List available skills'
    'install:Install one or more skills'
    'info:Show skill details'
    'search:Search for skills'
    'providers:Manage skill providers'
    'create:Create a new skill'
    'validate:Validate skill structure'
    'update:Update installed skills'
    'uninstall:Uninstall skills'
    'init:Initialize arcana in project'
    'doctor:Check environment'
    'clean:Remove orphaned data'
    'compact:Remove agent logs'
    'stats:Show session analytics'
    'config:View or modify config'
    'audit:Audit skill quality'
    'scan:Scan for security threats'
    'optimize:Suggest improvements'
    'verify:Verify skill integrity'
    'lock:Manage lockfile'
    'profile:Manage skill profiles'
    'benchmark:Measure token cost'
    'diff:Show skill changes'
    'outdated:List outdated skills'
    'team:Team skill management'
    'export:Export skill manifest'
    'import:Import skills'
    'completions:Generate shell completions'
  )
  _describe 'command' commands
}
_arcana
`;
const FISH_COMPLETIONS = `# arcana fish completion
set -l commands list install info search providers create validate update uninstall init doctor clean compact stats config audit scan optimize verify lock profile benchmark diff outdated team export import completions
complete -c arcana -f
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a list -d "List available skills"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a install -d "Install skills"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a info -d "Show skill details"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a search -d "Search for skills"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a providers -d "Manage providers"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a create -d "Create a skill"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a validate -d "Validate skills"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a update -d "Update skills"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a uninstall -d "Uninstall skills"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a init -d "Initialize arcana"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a doctor -d "Check environment"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a clean -d "Remove orphaned data"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a compact -d "Remove agent logs"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a stats -d "Session analytics"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a config -d "View/modify config"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a audit -d "Audit skill quality"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a scan -d "Security scan"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a optimize -d "Suggest improvements"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a verify -d "Verify integrity"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a lock -d "Manage lockfile"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a profile -d "Skill profiles"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a benchmark -d "Measure token cost"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a diff -d "Show skill changes"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a outdated -d "List outdated skills"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a team -d "Team management"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a export -d "Export manifest"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a import -d "Import skills"
complete -c arcana -n "not __fish_seen_subcommand_from $commands" -a completions -d "Shell completions"
`;
const SHELLS = {
    bash: BASH_COMPLETIONS,
    zsh: ZSH_COMPLETIONS,
    fish: FISH_COMPLETIONS,
};
export function completionsCommand(shell, opts) {
    const supported = Object.keys(SHELLS);
    if (!supported.includes(shell)) {
        if (opts.json) {
            console.log(JSON.stringify({ error: `Unsupported shell: ${shell}`, supported }));
        }
        else {
            console.error(`Unsupported shell: ${shell}`);
            console.error(`Supported: ${supported.join(", ")}`);
        }
        process.exit(1);
    }
    if (opts.json) {
        console.log(JSON.stringify({ shell, script: SHELLS[shell] }));
    }
    else {
        console.log(SHELLS[shell]);
    }
}
