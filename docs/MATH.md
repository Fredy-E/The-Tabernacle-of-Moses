# The mathematics behind the scene

These formulas describe the functions implemented in `index.html`. The page constructs its geometry directly; there are no imported mesh files.

## Dimensions and coordinates

The modeling scale uses `C = 0.4572` metres per cubit and `cu(n) = n × C`. This is a visualization convention. The east-to-west journey follows the scene's X axis; Y points upward.

## Parametric surfaces

For a tapered cylinder of height `h`, interpolate the radius between `r₀` and `r₁`:

```text
r(y) = r₀ + (r₁ − r₀)y/h
p(θ, y) = (r(y)cos θ, y, r(y)sin θ)
```

The cylinder builder connects sampled rings with triangles. Its normal includes the taper slope `(r₀ − r₁)/h`.

A sphere of radius `r` is sampled over longitude `θ` and polar angle `φ`:

```text
p(θ, φ) = r(sin φ cos θ, cos φ, sin φ sin θ)
```

A torus uses a major radius `R` and tube radius `r`:

```text
p(θ, φ) = ((R + r cos φ)cos θ, r sin φ, (R + r cos φ)sin θ)
```

The lathe builder rotates a sampled `(radius, height)` profile about Y:

```text
p(θ, k) = (radius[k]cos θ, height[k], radius[k]sin θ)
```

This creates vessels and other curved objects without storing an external mesh.

## Tubes along a path

The menorah branches and curved parts follow sampled paths. At each point, a tangent is estimated from neighboring samples. The previous normal is projected perpendicular to the new tangent, then normalized; the binormal is their cross product. A circular ring is placed in that local frame:

```text
nₖ = normalize(nₖ₋₁ − tₖ dot(nₖ₋₁, tₖ))
bₖ = cross(tₖ, nₖ)
pₖ(θ) = centreₖ + radiusₖ(nₖ cos θ + bₖ sin θ)
```

This transported frame limits arbitrary twisting along the tube. A taper can vary the radius from one path sample to the next.

## Transforms and normals

The transform stack composes translation, rotation, and scale as column-major 4 × 4 matrices. Vertices use the composed transform. Normals use the inverse-transpose direction, implemented with the cofactor matrix and normalization, so nonuniform scaling does not tilt the lighting incorrectly.

```text
p_world = M p_local
n_world = normalize((M₃ₓ₃⁻¹)ᵀ n_local)
p_clip = P V p_world
```

Triangle winding is checked against supplied surface normals before submission. The geometry tests verify primitive winding and a nonuniform normal transform.

## Scroll becomes camera motion

Each step contributes an anchor measured from its document position. Between adjacent anchors `aᵢ` and `aᵢ₊₁`, scroll position `y` becomes a bounded local fraction:

```text
u = clamp((y − aᵢ)/(aᵢ₊₁ − aᵢ), 0, 1)
q(u) = 6u⁵ − 15u⁴ + 10u³
t_target = i + q(u)
```

The quintic polynomial has zero first and second derivatives at its endpoints. Camera progress follows the target with exponential damping:

```text
t ← t + (t_target − t)(1 − exp(−3.4 Δt))
```

Position, look target, field of view, exposure, and composition shift are interpolated between the neighboring entries in `POSES`. The extra lateral view-space shift places the 3D subject beside the text on wide screens. Reduced motion follows the target directly and removes decorative drift.

## Curtain gathering and ark opening

Curtain vertices belong to separate left and right panels. Each panel compresses toward its outer edge as its opening amount increases:

```text
scale = 1 − 0.90 × open
z′ = side × halfWidth + (z − side × halfWidth) × scale
```

The ark cover rotates around a modeled hinge. Its maximum angle is `1.92` radians:

```text
angle = 1.92 × open
p′ = hinge + Rz(angle)(p − hinge)
```

The same deformation code is included in the visible and shadow vertex shaders. Surface UVs refer to original positions so texture detail remains attached as the cover moves.

## Material shading

The detailed shader uses a GGX-style normal distribution, a Schlick-style geometry term, and a fifth-power Fresnel approximation. With view `V`, light `L`, normal `N`, and half vector `H = normalize(V + L)`:

```text
a = max(roughness², 0.006)
D = a² / (π((N·H)²(a² − 1) + 1)²)
F₀ = mix(0.04, baseColor, metallic)
F = F₀ + (1 − F₀)(1 − V·H)⁵
specular = D G F / max(4(N·V)(N·L), 0.001)
diffuse = (1 − F)(1 − metallic)baseColor / π
```

The direct-light contribution multiplies the sum by `max(N·L, 0)`. Ambient reflection approximations and generated surface detail supplement this term. The shader is a real-time approximation; it does not trace light transport.

## Deterministic detail

Noise begins with a sine hash of the sample coordinates. Bilinear interpolation uses cubic smoothstep; three weighted octaves form the CPU-side `fbm` function. Cloth combines periodic folds, an edge envelope, and sag. These functions create variations from coordinates rather than additional asset downloads.
