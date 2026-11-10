import React, { useLayoutEffect, useRef } from "react";
import type { Group, Matrix4 } from "three";

/** A group placed by a world matrix computed for this frame (pose objects from pure state, never by mutation over time). */
export const Posed: React.FC<{ matrix: Matrix4; children: React.ReactNode }> = ({ matrix, children }) => {
  const ref = useRef<Group>(null);
  useLayoutEffect(() => {
    ref.current!.matrix.copy(matrix);
    ref.current!.matrixWorldNeedsUpdate = true;
  });
  return (
    <group ref={ref} matrixAutoUpdate={false}>
      {children}
    </group>
  );
};
