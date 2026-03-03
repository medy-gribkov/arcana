# Runtime Security Configs

## Runtime Flags

Run containers read-only and drop all capabilities.

```bash
docker run --read-only --cap-drop=ALL --user 65532 myapp:latest
```

For Kubernetes:

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 65532
  readOnlyRootFilesystem: true
  capabilities:
    drop:
      - ALL
```

## Kubernetes Admission Control

Use OPA Gatekeeper or Kyverno to enforce policies at deploy time.

**Example Gatekeeper policy:** Block containers running as root.

```yaml
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sPSPAllowPrivilegeEscalationContainer
metadata:
  name: must-run-as-nonroot
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
  parameters:
    runAsUser:
      rule: MustRunAsNonRoot
```

**Example Kyverno policy:** Require CPU and memory limits.

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-resource-limits
spec:
  validationFailureAction: enforce
  rules:
    - name: check-limits
      match:
        resources:
          kinds:
            - Pod
      validate:
        message: "CPU and memory limits are required"
        pattern:
          spec:
            containers:
              - resources:
                  limits:
                    memory: "?*"
                    cpu: "?*"
```

## Seccomp Profiles

Restrict system calls available to containers.

**BAD:** Default seccomp profile allows 300+ syscalls.

**GOOD:** Use Docker's default seccomp profile at minimum.

```bash
docker run --security-opt seccomp=default.json myapp:latest
```

For Kubernetes:

```yaml
securityContext:
  seccompProfile:
    type: RuntimeDefault
```

## Runtime Monitoring with Falco

Alert on suspicious behavior inside containers.

**Example Falco rule:** Detect shell execution in containers.

```yaml
- rule: Shell Spawned in Container
  desc: Detect shell execution inside a container
  condition: >
    spawned_process and
    container and
    proc.name in (bash, sh, zsh)
  output: "Shell spawned in container (user=%user.name container=%container.id image=%container.image.repository)"
  priority: WARNING
```

Falco alerts can trigger automated responses (kill pod, notify security team).
