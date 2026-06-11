export function calcTotalCapsules(product, fullCases, looseSleeves) {
  const cases = parseInt(fullCases) || 0
  const loose = parseInt(looseSleeves) || 0
  return (cases * product.sleeves_per_case * product.capsules_per_sleeve) +
         (loose * product.capsules_per_sleeve)
}
