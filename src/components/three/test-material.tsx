import { useFrame, useThree } from "@react-three/fiber";
import {
  ForwardRefExoticComponent,
  PropsWithoutRef,
  RefAttributes,
  forwardRef,
  useState,
} from "react";
import {
  IUniform,
  MeshStandardMaterial,
  MeshStandardMaterialParameters,
} from "three";

type TestMaterialType = JSX.IntrinsicElements["meshStandardMaterial"] & {
  cameraLengthInverse?: number;
};

type Props = TestMaterialType & {};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      testMaterialImpl: TestMaterialType;
    }
  }
}

interface Uniform<T> {
  value: T;
}

class TestMaterialImpl extends MeshStandardMaterial {
  _cameraLengthInverse: Uniform<number>;

  constructor(parameters: MeshStandardMaterialParameters = {}) {
    super(parameters);
    this.setValues(parameters);
    this._cameraLengthInverse = { value: 0 };
  }

  // FIXME Use `THREE.WebGLProgramParametersWithUniforms` type when able to target @types/three@0.160.0
  onBeforeCompile(shader: {
    vertexShader: string;
    uniforms: { [uniform: string]: IUniform };
  }) {
    shader.uniforms.cameraLengthInverse = this._cameraLengthInverse;

    shader.vertexShader = `
uniform float cameraLengthInverse;
${shader.vertexShader}
`;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif

mvPosition = modelViewMatrix * mvPosition;

gl_Position = projectionMatrix * mvPosition;
`
    );
  }

  get cameraLengthInverse() {
    return this._cameraLengthInverse.value;
  }

  set cameraLengthInverse(v) {
    this._cameraLengthInverse.value = v;
  }
}

type ForwardRefComponent<P, T> = ForwardRefExoticComponent<
  PropsWithoutRef<P> & RefAttributes<T>
>;

export const MeshTestMaterial: ForwardRefComponent<Props, TestMaterialImpl> =
  forwardRef(({ ...props }: Props, ref) => {
    const [material] = useState(() => new TestMaterialImpl());
    const camera = useThree((s) => s.camera);
    useFrame((state) => {
      material.cameraLengthInverse = 1 / camera.position.length();
    });
    return (
      <primitive object={material} ref={ref} attach="material" {...props} />
    );
  });
